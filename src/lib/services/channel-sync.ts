import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaidMedium } from "@/lib/analytics/channel";
import { parseLinkUtms } from "@/lib/analytics/link-standard";
import { createBitlyClient, type BitlyClient } from "@/lib/bitly/client";
import { config } from "@/lib/config";
import {
  createGa4Client,
  type Ga4ChannelSessionRow,
  type Ga4Client,
} from "@/lib/ga4/client";
import {
  isChatbotCapture,
  isInternalLead,
} from "@/lib/services/admin-analytics-internal";
import {
  recordSyncRun,
  upsertChannelDaily,
  type ChannelDailyRow,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

/**
 * The three connectors that fill `channel_daily` from data this repo already
 * holds. Each writes only the metric columns it can see, and each is recorded
 * in `channel_sync_runs` whether it succeeds, fails or is skipped.
 *
 *  - ga4-visits: sessions per link key straight from GA4 (a second report on
 *    the same service account; ga4_page_views lacks medium/content/term).
 *  - bitly-clicks: bitly_link_clicks, re-keyed onto the link standard by
 *    reading the UTMs off each short link's long URL.
 *  - leads: lead_submissions (leads, booked, showed, won) by lead cohort day,
 *    plus Calendly bookings that never came through a lead form (booked).
 *
 * Windows differ on purpose: GA4 settles in 48h, Bitly is re-read for 30 days
 * like its own sync, and a lead's booked/showed/won keep changing for weeks as
 * Close reconciles, so leads re-read 120 days. `days` overrides all three for
 * a one-time backfill.
 */
const WINDOW_DAYS = { ga4: 3, bitly: 30, leads: 120 } as const;

/** Supabase pages at 1000 rows; anything longer must be walked explicitly. */
const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000;

export const CHANNEL_CONNECTORS = {
  ga4: "ga4-visits",
  bitly: "bitly-clicks",
  leads: "leads",
} as const;

export type ChannelSyncResult = {
  endDate: string;
  connectors: SyncRunOutcome[];
};

export async function syncChannelDaily(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    ga4Client?: Ga4Client | null;
    bitlyClient?: BitlyClient | null;
    now?: Date;
    /** Overrides every connector's window. Use once to backfill. */
    days?: number;
  } = {},
): Promise<ChannelSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const ga4 = deps.ga4Client === undefined ? ga4FromConfig() : deps.ga4Client;
  const bitly =
    deps.bitlyClient === undefined ? bitlyFromConfig() : deps.bitlyClient;
  const endDate = dayKey(now);
  const startFor = (defaultDays: number) =>
    dayKey(addDays(now, -(deps.days ?? defaultDays)));

  const connectors: SyncRunOutcome[] = [];
  // Sequential on purpose: three connectors writing the same table at once
  // would contend on the same primary keys for no gain on a daily cron.
  connectors.push(
    await recordSyncRun(client, CHANNEL_CONNECTORS.ga4, () =>
      syncGa4Visits(client, ga4, startFor(WINDOW_DAYS.ga4), endDate, now),
    ),
  );
  connectors.push(
    await recordSyncRun(client, CHANNEL_CONNECTORS.bitly, () =>
      syncBitlyClicks(client, bitly, startFor(WINDOW_DAYS.bitly), endDate, now),
    ),
  );
  connectors.push(
    await recordSyncRun(client, CHANNEL_CONNECTORS.leads, () =>
      syncLeads(client, startFor(WINDOW_DAYS.leads), endDate, now),
    ),
  );
  return { endDate, connectors };
}

/** Recorded as a non-failing run so the health table shows amber, not red. */
export function skipped(reason: string) {
  return { rowsWritten: 0, error: `skipped: ${reason}` };
}

async function syncGa4Visits(
  client: SyncClient,
  ga4: Ga4Client | null,
  startDate: string,
  endDate: string,
  now: Date,
) {
  if (!ga4) return skipped("GA4 service account is not configured.");
  const range = { startDate, endDate };
  const key = (row: Ga4ChannelSessionRow) => ({
    day: row.day,
    source: ga4Value(row.source),
    medium: ga4Value(row.medium),
    campaign: ga4Campaign(row),
    content: ga4Value(row.content),
    term: ga4Value(row.term),
  });

  const sessions = await ga4.fetchChannelSessions(range);
  const visits = await upsertChannelDaily(
    client,
    sessions.map((row) => ({ ...key(row), visits: row.sessions })),
    { now },
  );

  // A second report, and a second upsert: a batch must carry one shape, and
  // the two reports do not return the same set of link keys.
  const thankYou = await ga4.fetchThankYouSessions(range);
  const confirmations = await upsertChannelDaily(
    client,
    thankYou.map((row) => ({ ...key(row), thankyou_visits: row.sessions })),
    { now },
  );

  return written({
    written: visits.written + confirmations.written,
    failed: visits.failed + confirmations.failed,
  });
}

/**
 * The campaign value that matches what the link carried.
 *
 * Google Ads auto-tagging gives GA4 the campaign NAME, but the tracking
 * template writes `utm_campaign=<numeric campaign id>`, so a paid Google row's
 * visits sat under "VP - Search - Brand" while its leads sat under
 * "23805931083" and every paired rate for Google Ads came out null (seen on
 * the KPI tab 2026-09-11: 5,254 visits and 122 leads, opt-in a dash). For paid
 * Google traffic the id is what the link standard sees, so it wins; every
 * other row keeps the name, which is what its links carry.
 */
function ga4Campaign(row: Ga4ChannelSessionRow): string {
  const source = ga4Value(row.source).toLowerCase();
  const campaignId = ga4Value(row.campaignId);
  if (
    source === "google" &&
    isPaidMedium(ga4Value(row.medium)) &&
    // "0" is GA4's filler for a session with no Ads campaign behind it.
    /^[1-9]\d*$/.test(campaignId)
  ) {
    return campaignId;
  }
  return ga4Value(row.campaign);
}

/**
 * GA4 writes "(not set)" and "(direct)" where a UTM was absent. Both mean
 * "the link carried nothing here", which is what a blank means to the spine.
 */
function ga4Value(value: string): string {
  return value === "(not set)" || value === "(direct)" || value === "(none)"
    ? ""
    : value;
}

type ClickRow = { bitly_id: string; day: string; clicks: number };

async function syncBitlyClicks(
  client: SyncClient,
  bitly: BitlyClient | null,
  startDate: string,
  endDate: string,
  now: Date,
) {
  const clicks = await pageAll<ClickRow>((from, to) =>
    client
      .from("bitly_link_clicks")
      .select("bitly_id,day,clicks")
      .gte("day", startDate)
      .lte("day", endDate)
      .order("bitly_id")
      .order("day")
      .range(from, to),
  );
  if (clicks.length === 0) return { rowsWritten: 0 };

  const utmsById = await bitlyLinkUtms(client, bitly);
  let unmapped = 0;
  const rows: ChannelDailyRow[] = clicks.map((click) => {
    const utms = utmsById.get(click.bitly_id);
    if (!utms) unmapped += 1;
    return {
      day: click.day,
      source: utms?.source ?? null,
      medium: utms?.medium ?? null,
      campaign: utms?.campaign ?? null,
      content: utms?.content ?? null,
      term: utms?.term ?? null,
      clicks: click.clicks,
    };
  });
  const result = await upsertChannelDaily(client, rows, { now });
  return {
    ...written(result),
    // Not an error: an unmapped click is still a click. It lands under
    // "(not set)" / Website and the count here says how many did.
    error:
      unmapped > 0
        ? `${unmapped} click rows had no UTMs on their long URL.`
        : null,
  };
}

type LinkUtms = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

/**
 * bitly_id → the UTMs on its long URL, from the most authoritative source
 * available: Bitly's own listing (the link is the attribution), then the
 * builder registry, then the YouTube registry (campaign only, source youtube).
 */
async function bitlyLinkUtms(
  client: SyncClient,
  bitly: BitlyClient | null,
): Promise<Map<string, LinkUtms>> {
  const map = new Map<string, LinkUtms>();

  const videos = await pageAll<{ bitly_id: string; utm_campaign: string }>(
    (from, to) =>
      client
        .from("youtube_videos")
        .select("bitly_id,utm_campaign")
        .not("bitly_id", "is", null)
        .order("utm_campaign")
        .range(from, to),
  );
  for (const video of videos) {
    map.set(video.bitly_id, {
      source: "youtube",
      medium: null,
      campaign: video.utm_campaign,
      content: null,
      term: null,
    });
  }

  const links = await pageAll<{ bitly_id: string; url: string }>((from, to) =>
    client
      .from("marketing_links")
      .select("bitly_id,url")
      .not("bitly_id", "is", null)
      .order("created_at")
      .range(from, to),
  );
  for (const link of links) {
    const utms = parseLinkUtms(link.url);
    if (utms) map.set(link.bitly_id, utms);
  }

  if (bitly && config.BITLY_GROUP_GUID) {
    const listed = await bitly.listGroupLinks(config.BITLY_GROUP_GUID);
    for (const link of listed) {
      const utms = parseLinkUtms(link.longUrl);
      if (utms && utms.source) map.set(link.id, utms);
    }
  }
  return map;
}

type LeadRow = {
  created_at: string;
  email: string | null;
  full_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  call_booked_at: string | null;
  call_outcome: string | null;
  closed_won_at: string | null;
  /** Added by 20260912120000; absent until that migration runs. */
  closed_won_value?: number | null;
  metadata: unknown;
};

type BookingRow = {
  created_at: string;
  /** Calendly's own "this call was booked at", from the stored payload. */
  booked_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

/**
 * Leads by cohort day: a lead's booked / showed / won are credited to the day
 * the lead arrived, so a channel row's booked ÷ leads is a real rate over one
 * population. "showed" is a derivation, not an observation: booked minus the
 * outcomes that assert the call did not happen (matching the YouTube tab).
 * Revenue is the lead's won Close deal value, mirrored by the reconciler.
 */
async function syncLeads(
  client: SyncClient,
  startDate: string,
  endDate: string,
  now: Date,
) {
  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${dayKey(addDays(new Date(`${endDate}T00:00:00.000Z`), 1))}T00:00:00.000Z`;

  const base =
    "created_at,email,full_name,utm_source,utm_medium,utm_campaign,utm_content,utm_term,call_booked_at,call_outcome,closed_won_at,metadata";
  // Probed once, not guessed: the deal-value column ships ahead of being
  // applied by hand, and selecting a column that is not there yet would fail
  // the whole leads connector rather than the one column.
  const { error: valueError } = await client
    .from("lead_submissions")
    .select("closed_won_value")
    .limit(1);
  const revenueConnected = !valueError;

  const leads = await pageAll<LeadRow>((from, to) =>
    client
      .from("lead_submissions")
      .select(revenueConnected ? `${base},closed_won_value` : base)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at")
      .range(from, to),
  );

  const rows: ChannelDailyRow[] = leads
    .filter((lead) => !isInternalLead(lead.email, lead.full_name))
    .map((lead) => {
      const booked = lead.call_booked_at ? 1 : 0;
      const showed =
        booked &&
        lead.call_outcome !== "no_show" &&
        lead.call_outcome !== "canceled"
          ? 1
          : 0;
      const won = lead.closed_won_at || lead.call_outcome === "won" ? 1 : 0;
      // A lead the site chatbot captured mid-conversation with no campaign
      // tag is the chatbot's lead, not the site's. Written as the source so
      // the read-time re-labelling reaches the same answer.
      const chatbot =
        !lead.utm_source?.trim() && isChatbotCapture(lead.metadata);
      return {
        day: lead.created_at.slice(0, 10),
        source: chatbot ? "chatbot" : lead.utm_source,
        medium: chatbot ? "chat" : lead.utm_medium,
        campaign: lead.utm_campaign,
        content: lead.utm_content,
        term: lead.utm_term,
        leads: 1,
        booked,
        showed,
        won,
        // Credited to the lead's cohort day like booked / showed / won, so a
        // channel's revenue sits over the same population as its leads. Null
        // for a lead that has not won: not observed, not zero.
        revenue: lead.closed_won_value ?? null,
      };
    });

  // Bookings with a tagged link but no lead form behind them (a direct Calendly
  // link in a bio, say). They are bookings this link earned, so they count as
  // booked; leads stays unobserved for them.
  const bookings = await pageAll<BookingRow>((from, to) =>
    client
      .from("calendly_bookings")
      .select(
        "created_at,booked_at:raw_payload->payload->>created_at,utm_source,utm_medium,utm_campaign,utm_content,utm_term",
      )
      .eq("status", "booked")
      .is("lead_submission_id", null)
      .not("utm_source", "is", null)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at")
      .range(from, to),
  );
  // The day Calendly says the call was booked, not the day this mirror row was
  // written. A backfill inserts months of history in one afternoon; bucketing
  // on the row's own created_at piles all of it onto the import date and every
  // month-to-date number downstream is wrong.
  const bookingRows: ChannelDailyRow[] = bookings.map((booking) => ({
    day: (booking.booked_at ?? booking.created_at).slice(0, 10),
    source: booking.utm_source,
    medium: booking.utm_medium,
    campaign: booking.utm_campaign,
    content: booking.utm_content,
    term: booking.utm_term,
    leads: null,
    booked: 1,
    showed: null,
    won: null,
    // Same shape as the lead rows above: PostgREST rejects an upsert batch
    // whose objects do not all carry the same keys.
    revenue: null,
  }));

  return written(
    await upsertChannelDaily(client, [...rows, ...bookingRows], { now }),
  );
}

function written(result: { written: number; failed: number }) {
  return {
    rowsWritten: result.written,
    error:
      result.failed > 0
        ? `${result.failed} rows failed to write; see the server log.`
        : null,
  };
}

/** Walks a PostgREST query page by page. Throws on a read error. */
async function pageAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Read failed: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function ga4FromConfig(): Ga4Client | null {
  const serviceAccountJson = config.GA4_SERVICE_ACCOUNT_JSON;
  const propertyId = config.GA4_PROPERTY_ID;
  if (!serviceAccountJson || !propertyId) return null;
  try {
    return createGa4Client({ serviceAccountJson, propertyId });
  } catch {
    return null;
  }
}

function bitlyFromConfig(): BitlyClient | null {
  if (!config.BITLY_ACCESS_TOKEN) return null;
  return createBitlyClient({ accessToken: config.BITLY_ACCESS_TOKEN });
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
