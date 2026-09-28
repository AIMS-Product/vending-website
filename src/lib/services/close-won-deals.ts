import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createCloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { CALENDLY_BOOKED_AT_PATH } from "@/lib/services/calendly-bookings";
import {
  cachedCloseReads,
  closeChannelLabel,
  fetchCloseDeals,
  type CloseDeal,
} from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * The Closed-won tab: every won Close opportunity in a range, where it came
 * from, when we first engaged the buyer, and how long the sale took.
 *
 * Wins are Close's (fetchCloseDeals, the same read as Channels and Month over
 * month), never lead_submissions. "First engaged" is the earliest of:
 *   - the Close lead's creation (close_lead_funnel.lead_created_at, or Close)
 *   - Close activity dated before that (imported leads carry older emails)
 *   - the first site form fill (lead_submissions, from 2026-07-06 only)
 *   - the first chatbot conversation
 *   - the first Calendly booking, dated by when it was booked
 * Webinar registrations are not per person in our tables (webinar_events is
 * one row per webinar); a webinar buyer's Close lead is created from GHL at
 * registration, which the first signal covers.
 */

type Client = Pick<SupabaseClient<Database>, "from">;

export const WON_SOURCE =
  'Close: every won deal, dated by the day it was won, credited to the lead\'s "Funnel Name DEAL (Opp)".';

export type EngagementSignal =
  | "Close lead created"
  | "Close activity"
  | "Site form"
  | "Chatbot"
  | "Calendly booking";

export type WonDeal = {
  leadId: string;
  name: string | null;
  source: string;
  funnel: string | null;
  /** First-touch UTM from the lead's earliest site form, when there is one. */
  firstTouch: string | null;
  dateWon: string;
  value: number | null;
  closer: string | null;
  firstEngagedAt: string | null;
  firstEngagedVia: EngagementSignal | null;
  daysToClose: number | null;
};

export type SourceRollup = {
  source: string;
  won: number;
  revenue: number;
  avgDeal: number | null;
  medianDays: number | null;
  p75Days: number | null;
  /** First calls shown in the range with this source (close_lead_funnel). */
  shown: number;
  /** won / shown. Different cohorts: a range, not a follow-through rate. */
  closeRate: number | null;
};

export type WonDealsReport =
  | {
      ok: true;
      from: string;
      to: string;
      deals: WonDeal[];
      rollup: SourceRollup[];
      totals: { won: number; revenue: number; medianDays: number | null };
    }
  | { ok: false; error: string };

type Signals = Partial<Record<EngagementSignal, string>>;

/** The earliest signal. Ties go to the first-listed (Close first). */
export function firstEngagement(
  signals: Signals,
): { at: string; via: EngagementSignal } | null {
  let best: { at: string; via: EngagementSignal } | null = null;
  for (const [via, at] of Object.entries(signals) as Array<
    [EngagementSignal, string | undefined]
  >) {
    if (!at) continue;
    if (!best || Date.parse(at) < Date.parse(best.at)) best = { at, via };
  }
  return best;
}

/** Whole days from first engagement to the won day (never negative). */
export function daysBetween(firstAt: string, dateWon: string): number {
  const start = Date.parse(firstAt.slice(0, 10));
  const end = Date.parse(dateWon);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/** Nearest-rank percentile of a sorted list. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function rollupBySource(
  deals: WonDeal[],
  shownBySource: Map<string, number>,
): SourceRollup[] {
  const groups = new Map<string, WonDeal[]>();
  for (const d of deals)
    groups.set(d.source, [...(groups.get(d.source) ?? []), d]);
  return [...groups]
    .map(([source, list]) => {
      const valued = list.filter((d) => d.value !== null);
      const revenue = valued.reduce((s, d) => s + (d.value ?? 0), 0);
      const days = list
        .map((d) => d.daysToClose)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
      const shown = shownBySource.get(source) ?? 0;
      return {
        source,
        won: list.length,
        revenue,
        avgDeal: valued.length ? revenue / valued.length : null,
        medianDays: percentile(days, 50),
        p75Days: percentile(days, 75),
        shown,
        closeRate: shown ? list.length / shown : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.won - a.won);
}

const earliest = (a: string | undefined, b: string | null | undefined) =>
  !b ? a : !a || Date.parse(b) < Date.parse(a) ? b : a;

function check(what: string, error: { message: string } | null) {
  if (error) throw new Error(`${what} read failed: ${error.message}`);
}

const cachedActivitiesBefore = unstable_cache(
  async (leadId: string, before: string) => {
    const result = await createCloseClient({
      apiKey: config.CLOSE_API_KEY,
    }).listLeadActivitiesBefore(leadId, before);
    const dates = (result.data ?? [])
      .map((a) => a.date_created)
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    return dates[0] ?? null;
  },
  ["close-activity-before-lead"],
  // Activity before a lead existed does not change; a day keeps Close quiet.
  { revalidate: 86_400 },
);

const CONCURRENCY = 4;

async function eachLimited<T>(items: T[], run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        await run(item);
      }
    }),
  );
}

async function readSignals(
  client: Client,
  deals: CloseDeal[],
  from: string,
  to: string,
) {
  const leadIds = [...new Set(deals.map((d) => d.leadId))];
  const lead = new Map<
    string,
    { name: string | null; email: string | null; createdAt: string | null }
  >();
  for (let i = 0; i < leadIds.length; i += 100) {
    const { data, error } = await client
      .from("close_lead_funnel")
      .select("lead_id, display_name, email, lead_created_at")
      .in("lead_id", leadIds.slice(i, i + 100));
    check("close_lead_funnel", error);
    for (const r of data ?? []) {
      lead.set(r.lead_id, {
        name: r.display_name,
        email: r.email?.toLowerCase() ?? null,
        createdAt: r.lead_created_at,
      });
    }
  }
  const close = cachedCloseReads();
  await eachLimited(
    leadIds.filter((id) => !lead.get(id)?.createdAt),
    async (id) => {
      const read = await close.getLead(id);
      lead.set(id, {
        name: lead.get(id)?.name ?? read?.display_name ?? null,
        email: lead.get(id)?.email ?? null,
        createdAt: read?.date_created ?? null,
      });
    },
  );
  const activity = new Map<string, string | null>();
  await eachLimited(leadIds, async (id) => {
    const createdAt = lead.get(id)?.createdAt;
    activity.set(
      id,
      createdAt ? await cachedActivitiesBefore(id, createdAt) : null,
    );
  });

  const emails = [
    ...new Set([...lead.values()].map((l) => l.email).filter(Boolean)),
  ] as string[];
  const form = new Map<string, { at: string; utm: string | null }>();
  const chat = new Map<string, string>();
  const booking = new Map<string, string>();
  const keep = (
    map: Map<string, string>,
    key: string | null,
    at: string | null,
  ) => {
    if (key && at) map.set(key, earliest(map.get(key), at) as string);
  };
  for (let i = 0; i < Math.max(leadIds.length, emails.length); i += 100) {
    const ids = leadIds.slice(i, i + 100);
    const mails = emails.slice(i, i + 100);
    const [byId, byMail, chats, books] = await Promise.all([
      ids.length
        ? client
            .from("lead_submissions")
            .select(
              "close_lead_id, email, created_at, utm_source, utm_medium, utm_campaign",
            )
            .in("close_lead_id", ids)
        : null,
      mails.length
        ? client
            .from("lead_submissions")
            .select(
              "close_lead_id, email, created_at, utm_source, utm_medium, utm_campaign",
            )
            .in("email", mails)
        : null,
      mails.length
        ? client
            .from("chatbot_conversations")
            .select("captured_email, created_at")
            .in("captured_email", mails)
        : null,
      mails.length
        ? client
            .from("calendly_bookings")
            .select(`invitee_email, booked_at:${CALENDLY_BOOKED_AT_PATH}`)
            .in("invitee_email", mails)
        : null,
    ]);
    for (const read of [byId, byMail]) {
      check("lead_submissions", read?.error ?? null);
      for (const r of read?.data ?? []) {
        const key = r.close_lead_id ?? r.email.toLowerCase();
        const seen = form.get(key);
        if (!seen || Date.parse(r.created_at) < Date.parse(seen.at)) {
          const utm = [r.utm_source, r.utm_medium, r.utm_campaign]
            .filter(Boolean)
            .join(" / ");
          form.set(key, { at: r.created_at, utm: utm || null });
        }
      }
    }
    check("chatbot_conversations", chats?.error ?? null);
    for (const r of chats?.data ?? [])
      keep(chat, r.captured_email?.toLowerCase() ?? null, r.created_at);
    check("calendly_bookings", books?.error ?? null);
    for (const r of (books?.data ?? []) as Array<{
      invitee_email: string | null;
      booked_at: string | null;
    }>) {
      keep(booking, r.invitee_email?.toLowerCase() ?? null, r.booked_at);
    }
  }

  // First calls shown in the range, by source: the close-rate denominator.
  const shown = new Map<string, number>();
  const shows = await client
    .from("close_lead_funnel")
    .select("funnel")
    .gte("first_sales_call_booked_date", from)
    .lte("first_sales_call_booked_date", to)
    .ilike("first_call_show_up", "yes")
    .limit(10_000);
  check("close_lead_funnel shows", shows.error);
  for (const r of shows.data ?? []) {
    const label = closeChannelLabel(r.funnel);
    shown.set(label, (shown.get(label) ?? 0) + 1);
  }
  return { lead, activity, form, chat, booking, shown };
}

export function toWonDeal(
  deal: CloseDeal,
  s: Awaited<ReturnType<typeof readSignals>>,
): WonDeal {
  const lead = s.lead.get(deal.leadId);
  const email = lead?.email ?? null;
  const formHit =
    s.form.get(deal.leadId) ?? (email ? s.form.get(email) : undefined);
  const first = firstEngagement({
    "Close lead created": lead?.createdAt ?? undefined,
    "Close activity": s.activity.get(deal.leadId) ?? undefined,
    "Site form": formHit?.at,
    Chatbot: email ? s.chat.get(email) : undefined,
    "Calendly booking": email ? s.booking.get(email) : undefined,
  });
  return {
    leadId: deal.leadId,
    name: lead?.name ?? null,
    source: closeChannelLabel(deal.funnel),
    funnel: deal.funnel,
    firstTouch: formHit?.utm ?? null,
    dateWon: deal.dateWon,
    value: deal.value,
    closer: deal.closer,
    firstEngagedAt: first?.at ?? null,
    firstEngagedVia: first?.via ?? null,
    daysToClose: first ? daysBetween(first.at, deal.dateWon) : null,
  };
}

/** Never throws: a Close or table failure comes back as ok: false. */
export async function getWonDeals(input: {
  from: string;
  to: string;
  client?: Client;
}): Promise<WonDealsReport> {
  if (!config.CLOSE_API_KEY)
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  const client = input.client ?? createAdminClient();
  try {
    const deals = await fetchCloseDeals({
      from: input.from,
      to: input.to,
      close: cachedCloseReads(),
      mirror: client,
    });
    const signals = await readSignals(client, deals, input.from, input.to);
    const rows = deals
      .map((d) => toWonDeal(d, signals))
      .sort((a, b) => b.dateWon.localeCompare(a.dateWon));
    const days = rows
      .map((d) => d.daysToClose)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    return {
      ok: true,
      from: input.from,
      to: input.to,
      deals: rows,
      rollup: rollupBySource(rows, signals.shown),
      totals: {
        won: rows.length,
        revenue: rows.reduce((s, d) => s + (d.value ?? 0), 0),
        medianDays: percentile(days, 50),
      },
    };
  } catch (error) {
    console.error("Closed-won tab read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
