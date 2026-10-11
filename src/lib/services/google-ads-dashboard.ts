import { LEADS_LIVE_FROM } from "@/lib/services/funnel-monthly";
import {
  liveAdsOf,
  servedCopy,
  type DisplayCreative,
  type LiveAd,
} from "@/lib/services/google-ads-live-ads";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAdminAnalyticsRange,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHANGE_DATE } from "@/lib/services/google-ads-changelog";
import { pacificDay } from "@/lib/services/funnel-board";
import {
  beforeAfter,
  campaignHealth,
  lastCompleteDay,
  leadKeyword,
  wastedSearchTerms,
  weeklyTrend,
  type BeforeAfter,
  type CampaignHealth,
  type WastedTerm,
  type Week,
} from "@/lib/services/google-ads-insights";

/**
 * Google Ads by campaign and keyword: spend from the Google Ads Script
 * (google_ads_* views), leads, booked calls and wins from site leads that
 * carry a gclid. Leads join on utm_campaign (the campaign id, set by the
 * account's final URL suffix) and utm_term (the keyword, since 2026-10-10).
 * Wins are site-lead wins (closed_won_at), not every Close opportunity.
 * A lead from before utm_term existed gets its keyword from its click
 * (google_ads_clicks, by gclid); with neither it reads "(pre-tracking)".
 */

export type SpendRow = {
  key: string;
  label: string;
  cost: number;
  clicks: number;
  impressions: number;
};

export type AdLead = {
  gclid: string;
  /** Pacific day the lead came in. */
  day: string;
  campaign: string | null;
  term: string | null;
  booked: boolean;
  won: boolean;
  wonValue: number;
};

export type GoogleAdsRow = {
  key: string;
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
  booked: number;
  won: number;
  wonValue: number;
  costPerBooked: number | null;
};

/** One ad over the selected range, with its current status. */
export type GoogleAdsAd = {
  adId: string;
  campaign: string;
  adGroup: string | null;
  headlines: string[];
  landing: string | null;
  status: string;
  approval: string | null;
  spend: number;
  clicks: number;
  impressions: number;
};

export type GoogleAdsDashboard = {
  rangeLabel: string;
  synced: boolean;
  totals: GoogleAdsRow;
  campaigns: GoogleAdsRow[];
  keywords: GoogleAdsRow[];
  /** Top ads by spend in the range (ad level: asset rows repeat the ad's spend). */
  ads: GoogleAdsAd[];
  weeks: Week[];
  beforeAfter: BeforeAfter;
  wasted: WastedTerm[];
  health: CampaignHealth[];
  /** CRM - Booked Call conversions Google counted in the last 30 days. */
  bookedInAds30d: number | null;
  /** False until the health migration is applied: health and waste are not read. */
  healthSetUp: boolean;
  liveAds: LiveAd[];
  displayCreatives: DisplayCreative[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function emptyRow(key: string, label: string): GoogleAdsRow {
  return {
    key,
    label,
    spend: 0,
    clicks: 0,
    impressions: 0,
    leads: 0,
    booked: 0,
    won: 0,
    wonValue: 0,
    costPerBooked: null,
  };
}

/** Unknown, not $0, when there is no spend row (script not synced yet). */
function costPer(spend: number, booked: number): number | null {
  return booked > 0 && spend > 0
    ? Math.round((spend / booked) * 100) / 100
    : null;
}

/** One lead per gclid: booked or won if any submission for it was. */
export function dedupeLeads(leads: AdLead[]): AdLead[] {
  const byGclid = new Map<string, AdLead>();
  for (const lead of leads) {
    const seen = byGclid.get(lead.gclid);
    byGclid.set(
      lead.gclid,
      seen
        ? {
            ...seen,
            campaign: seen.campaign ?? lead.campaign,
            term: seen.term ?? lead.term,
            booked: seen.booked || lead.booked,
            won: seen.won || lead.won,
            wonValue: Math.max(seen.wonValue, lead.wonValue),
          }
        : lead,
    );
  }
  return [...byGclid.values()];
}

/** Spend and leads per key, highest spend first; leads with no spend row still show. */
export function buildRows(
  spend: SpendRow[],
  leads: AdLead[],
  keyOf: (lead: AdLead) => string,
): GoogleAdsRow[] {
  const rows = new Map<string, GoogleAdsRow>();
  const rowFor = (key: string, label: string) => {
    const existing = rows.get(key);
    if (existing) return existing;
    const created = emptyRow(key, label);
    rows.set(key, created);
    return created;
  };
  for (const s of spend) {
    const row = rowFor(s.key, s.label);
    row.spend += s.cost;
    row.clicks += s.clicks;
    row.impressions += s.impressions;
  }
  for (const lead of leads) {
    const key = keyOf(lead);
    const row = rowFor(key, key);
    row.leads += 1;
    if (lead.booked) row.booked += 1;
    if (lead.won) {
      row.won += 1;
      row.wonValue += lead.wonValue;
    }
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      spend: Math.round(row.spend * 100) / 100,
      costPerBooked: costPer(row.spend, row.booked),
    }))
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads);
}

/** Leads whose utm_campaign is not a Google campaign id (link tags like "cohort_seats"). */
export const NO_CAMPAIGN_ID = "(no Google campaign id)";

export function campaignKey(campaign: string | null): string {
  return campaign && /^\d+$/.test(campaign) ? campaign : NO_CAMPAIGN_ID;
}

/** Per-ad totals for the range, highest spend first; status from the newest day. */
export function adsInRange(
  rows: Array<Record<string, unknown>>,
  campaignNames: Map<string, string>,
  limit = 12,
): GoogleAdsAd[] {
  const byAd = new Map<string, GoogleAdsAd & { day: string }>();
  for (const r of rows) {
    const adId = String(r.ad_id);
    const day = String(r.day);
    const existing = byAd.get(adId);
    const cost = num(r.cost);
    const clicks = num(r.clicks);
    const impressions = num(r.impressions);
    if (existing) {
      existing.spend += cost;
      existing.clicks += clicks;
      existing.impressions += impressions;
      if (day > existing.day) {
        existing.day = day;
        existing.status = String(r.status);
        existing.approval = (r.approval_status as string) ?? null;
      }
      continue;
    }
    const urls = Array.isArray(r.final_urls) ? r.final_urls.map(String) : [];
    const campaignId = String(r.campaign_id);
    byAd.set(adId, {
      adId,
      day,
      campaign: campaignNames.get(campaignId) ?? campaignId,
      adGroup: (r.ad_group_name as string) ?? null,
      headlines: Array.isArray(r.headlines) ? r.headlines.map(String) : [],
      landing: urls[0] ?? null,
      status: String(r.status),
      approval: (r.approval_status as string) ?? null,
      spend: cost,
      clicks,
      impressions,
    });
  }
  return [...byAd.values()]
    .filter((ad) => ad.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
    .map(({ day: _day, ...ad }) => ({
      ...ad,
      spend: Math.round(ad.spend * 100) / 100,
    }));
}

export function totalOf(rows: GoogleAdsRow[]): GoogleAdsRow {
  const total = rows.reduce(
    (sum, row) => {
      sum.spend += row.spend;
      sum.clicks += row.clicks;
      sum.impressions += row.impressions;
      sum.leads += row.leads;
      sum.booked += row.booked;
      sum.won += row.won;
      sum.wonValue += row.wonValue;
      return sum;
    },
    emptyRow("total", "All campaigns"),
  );
  total.spend = Math.round(total.spend * 100) / 100;
  total.costPerBooked = costPer(total.spend, total.booked);
  return total;
}

type Client = Pick<SupabaseClient, "from">;

class GoogleAdsReadError extends Error {
  code: string | undefined;
  constructor(code: string | undefined) {
    super("Could not read Google Ads data.");
    this.name = "GoogleAdsReadError";
    this.code = code;
  }
}

/**
 * The health views come from a hand-applied migration
 * (20261011120000_google_ads_health_reports.sql). Until it runs they do not
 * exist; the page says so instead of failing.
 */
const isMissingView = (error: unknown) =>
  error instanceof GoogleAdsReadError &&
  (error.code === "42P01" || error.code === "PGRST205");

async function readAll<T>(
  label: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { code?: string; message: string } | null;
  }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) {
      console.error(`google ads dashboard: ${label} read failed`, {
        code: error.code,
        message: error.message,
      });
      throw new GoogleAdsReadError(error.code);
    }
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** gclid -> the keyword its click carried, read in chunks (URL length). */
async function clickKeywords(
  client: Client,
  gclids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < gclids.length; i += 50) {
    const chunk = gclids.slice(i, i + 50);
    const rows = await readAll<Record<string, unknown>>("clicks", () =>
      client
        .from("google_ads_clicks")
        .select("gclid, keyword")
        .in("gclid", chunk)
        .range(0, 999),
    );
    for (const r of rows) {
      if (r.keyword) out.set(String(r.gclid), String(r.keyword));
    }
  }
  return out;
}

/** Status snapshots, search-term waste and Google's own booked-call count. */
async function readHealthOrMissing(
  client: Client,
  startDay: string,
  endDay: string,
  now: Date,
) {
  try {
    return {
      ...(await readHealth(client, startDay, endDay, now)),
      setUp: true,
    };
  } catch (error) {
    if (!isMissingView(error)) throw error;
    return {
      health: [],
      wasted: [],
      bookedInAds30d: null,
      setUp: false,
      adStatus: [],
      copy: [],
      creatives: [],
      enabledCampaigns: new Map<string, string>(),
    };
  }
}

async function readHealth(
  client: Client,
  startDay: string,
  endDay: string,
  now: Date,
) {
  const since30 = new Date(now.getTime() - 30 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const [
    campaignRows,
    adRows,
    termRows,
    convertingRows,
    bookedRows,
    copyRows,
    creativeRows,
  ] = await Promise.all([
    readAll<Record<string, unknown>>("campaign status", (from, to) =>
      client
        .from("google_ads_campaign_status")
        .select(
          "campaign_id, campaign_name, status, primary_status, primary_status_reasons, daily_budget",
        )
        .range(from, to),
    ),
    readAll<Record<string, unknown>>("ad status", (from, to) =>
      client
        .from("google_ads_ad_status")
        .select(
          "campaign_id, ad_group_name, ad_group_status, ad_id, status, approval_status, review_status",
        )
        .range(from, to),
    ),
    readAll<Record<string, unknown>>("search terms", (from, to) =>
      client
        .from("google_ads_search_term_daily")
        .select("search_term, campaign_id, cost, clicks")
        .gte("day", startDay)
        .lte("day", endDay)
        .gt("cost", 0)
        .range(from, to),
    ),
    readAll<Record<string, unknown>>("converting terms", (from, to) =>
      client
        .from("google_ads_search_term_conversions")
        .select("search_term")
        .range(from, to),
    ),
    readAll<Record<string, unknown>>("booked in ads", (from, to) =>
      client
        .from("google_ads_conversion_daily")
        .select("conversions")
        .eq("action_name", "CRM - Booked Call")
        .gte("day", since30)
        .range(from, to),
    ),
    // One row per ad (upserted); newest first so removed ads fall off below.
    readAll<Record<string, unknown>>("ad copy", (from, to) =>
      client
        .from("google_ads_rows")
        .select("synced_at, data")
        .eq("report", "ad_status")
        .order("synced_at", { ascending: false })
        .range(from, to),
    ),
    readAll<Record<string, unknown>>("creatives", (from, to) =>
      client
        .from("google_ads_creatives")
        .select(
          "ad_id, asset_id, asset_type, preview_url, impressions, clicks, cost",
        )
        .not("preview_url", "is", null)
        .order("impressions", { ascending: false })
        .range(from, to),
    ),
  ]);
  const converting = new Set(
    convertingRows.map((r) => String(r.search_term).trim().toLowerCase()),
  );
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const newest = String(copyRows[0]?.synced_at ?? "");
  const cutoff = newest
    ? new Date(Date.parse(newest) - 2 * 60 * 60 * 1000).toISOString()
    : "";
  const copy = copyRows
    .filter((r) => String(r.synced_at) >= cutoff)
    .map((r) => r.data as Record<string, unknown>)
    .filter((d) => strings(d.headlines).length > 0)
    .map((d) => ({
      adId: String(d.adId),
      headlines: strings(d.headlines),
      descriptions: strings(d.descriptions),
      finalUrls: strings(d.finalUrls),
    }));
  const enabledCampaigns = new Map(
    campaignRows
      .filter((r) => r.status === "ENABLED")
      .map((r) => [
        String(r.campaign_id),
        String(r.campaign_name ?? r.campaign_id),
      ]),
  );
  const campaignOfAd = new Map(
    adRows.map((r) => [String(r.ad_id), String(r.campaign_id)]),
  );
  const nameOf = new Map(
    campaignRows.map((r) => [
      String(r.campaign_id),
      String(r.campaign_name ?? r.campaign_id),
    ]),
  );
  const creatives: DisplayCreative[] = creativeRows.slice(0, 12).map((r) => ({
    assetId: String(r.asset_id),
    campaign: nameOf.get(campaignOfAd.get(String(r.ad_id)) ?? "") ?? "",
    kind: r.asset_type === "YOUTUBE_VIDEO" ? "video" : "image",
    previewUrl: String(r.preview_url),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    cost: Math.round(num(r.cost) * 100) / 100,
  }));
  return {
    adStatus: adRows,
    copy,
    creatives,
    enabledCampaigns,
    health: campaignHealth(
      campaignRows.map((r) => ({
        campaignId: String(r.campaign_id),
        name: String(r.campaign_name ?? r.campaign_id),
        status: String(r.status),
        primaryStatus: (r.primary_status as string) ?? null,
        reasons: strings(r.primary_status_reasons),
        dailyBudget: r.daily_budget == null ? null : num(r.daily_budget),
      })),
      adRows.map((r) => ({
        campaignId: String(r.campaign_id),
        adGroupStatus: (r.ad_group_status as string) ?? null,
        status: String(r.status),
        approval: (r.approval_status as string) ?? null,
        review: (r.review_status as string) ?? null,
      })),
    ),
    wasted: wastedSearchTerms(
      termRows.map((r) => ({
        term: String(r.search_term),
        campaignId: String(r.campaign_id),
        cost: num(r.cost),
        clicks: num(r.clicks),
      })),
      converting,
    ),
    // No rows at all means the report has not synced yet, not zero bookings.
    bookedInAds30d: bookedRows.length
      ? Math.round(bookedRows.reduce((sum, r) => sum + num(r.conversions), 0))
      : null,
  };
}

export async function getGoogleAdsDashboard(input: {
  range: AdminAnalyticsRangeKey;
  now?: Date;
  client?: Client;
}): Promise<GoogleAdsDashboard> {
  const client = input.client ?? (createAdminClient() as unknown as Client);
  const now = input.now ?? new Date();
  const { label, days, endsAt } = resolveAdminAnalyticsRange(input.range, now);
  // Spend before lead capture went live has no leads to join, so a range
  // reaching past it would price booked calls on spend that could never book.
  const liveFrom = Date.parse(`${LEADS_LIVE_FROM}T07:00:00Z`);
  const wanted = endsAt.getTime() - days * DAY_MS;
  const start = new Date(Math.max(wanted, liveFrom));
  const startDay = start.toISOString().slice(0, 10);
  const endDay = endsAt.toISOString().slice(0, 10);
  // Before vs after always needs everything since the change, whatever the range.
  const fromDay = startDay < CHANGE_DATE ? startDay : CHANGE_DATE;
  // The change day starts at midnight Pacific (07:00 UTC in October).
  const leadsFrom =
    startDay < CHANGE_DATE ? start.toISOString() : `${CHANGE_DATE}T07:00:00Z`;

  type CampaignDay = Record<string, unknown>;
  const [campaignDays, keywordDays, leadRows, adRows, extra] =
    await Promise.all([
      readAll<CampaignDay>("campaigns", (from, to) =>
        client
          .from("google_ads_campaign_daily")
          .select("day, campaign_id, campaign_name, cost, clicks, impressions")
          .gte("day", fromDay)
          .lte("day", endDay)
          .range(from, to),
      ),
      readAll<CampaignDay>("keywords", (from, to) =>
        client
          .from("google_ads_keyword_daily")
          .select("keyword, cost, clicks, impressions")
          .gte("day", startDay)
          .lte("day", endDay)
          .range(from, to),
      ),
      readAll<CampaignDay>("leads", (from, to) =>
        client
          .from("lead_submissions")
          .select(
            "created_at, utm_campaign, utm_term, call_booked_at, closed_won_at, closed_won_value, gclid:metadata->paid_attribution->>gclid",
          )
          .gte("created_at", leadsFrom)
          .lte("created_at", endsAt.toISOString())
          .not("metadata->paid_attribution->>gclid", "is", null)
          .range(from, to),
      ),
      readAll<Record<string, unknown>>("ads", (from, to) =>
        client
          .from("google_ads_ad_daily")
          .select(
            "day, campaign_id, ad_group_name, ad_id, status, approval_status, final_urls, headlines, descriptions, cost, clicks, impressions",
          )
          .gte("day", startDay)
          .lte("day", endDay)
          .range(from, to),
      ),
      readHealthOrMissing(client, startDay, endDay, now),
    ]);

  const names = new Map<string, string>();
  for (const r of campaignDays) {
    if (r.campaign_name)
      names.set(String(r.campaign_id), String(r.campaign_name));
  }
  const allLeads = dedupeLeads(
    leadRows.map((r) => ({
      gclid: String(r.gclid),
      day: pacificDay(String(r.created_at)),
      campaign: r.utm_campaign ? String(r.utm_campaign) : null,
      term: r.utm_term ? String(r.utm_term).trim().toLowerCase() : null,
      booked: Boolean(r.call_booked_at),
      won: Boolean(r.closed_won_at),
      wonValue: num(r.closed_won_value),
    })),
  );
  const inRange = (lead: AdLead) =>
    lead.day >= pacificDay(start.toISOString()) &&
    lead.day <= pacificDay(endsAt.toISOString());
  const leads = allLeads.filter(inRange);
  const clickKw = extra.setUp
    ? await clickKeywords(
        client,
        leads.filter((l) => !l.term).map((l) => l.gclid),
      )
    : new Map<string, string>();
  const rangeDays = campaignDays.filter(
    (r) => String(r.day) >= startDay && String(r.day) <= endDay,
  );

  const campaigns = buildRows(
    rangeDays.map((r) => ({
      key: String(r.campaign_id),
      label: String(r.campaign_name ?? r.campaign_id),
      cost: num(r.cost),
      clicks: num(r.clicks),
      impressions: num(r.impressions),
    })),
    leads,
    (lead) => campaignKey(lead.campaign),
  ).map((row) => ({ ...row, label: names.get(row.key) ?? row.label }));

  const keywords = buildRows(
    keywordDays.map((r) => {
      const keyword = String(r.keyword ?? "")
        .trim()
        .toLowerCase();
      return {
        key: keyword,
        label: keyword,
        cost: num(r.cost),
        clicks: num(r.clicks),
        impressions: num(r.impressions),
      };
    }),
    leads,
    (lead) => leadKeyword(lead.term, clickKw.get(lead.gclid)),
    // Paused keywords with no spend and no lead in the range are noise.
  ).filter((row) => row.spend > 0 || row.leads > 0);

  const daySpend = (rows: CampaignDay[]) =>
    rows.map((r) => ({ day: String(r.day), cost: num(r.cost) }));
  return {
    rangeLabel:
      wanted < liveFrom
        ? `${label} (since Jul 27, when lead tracking began)`
        : label,
    synced: rangeDays.length > 0,
    totals: totalOf(campaigns),
    campaigns,
    keywords,
    ads: adsInRange(adRows, names),
    weeks: weeklyTrend(daySpend(rangeDays), leads),
    beforeAfter: beforeAfter(
      daySpend(campaignDays),
      allLeads,
      lastCompleteDay(pacificDay(now.toISOString())),
    ),
    wasted: extra.wasted,
    health: extra.health,
    bookedInAds30d: extra.bookedInAds30d,
    healthSetUp: extra.setUp,
    liveAds: liveAdsOf(
      extra.adStatus,
      extra.copy,
      adsInRange(
        adRows.filter((r) => String(r.day) >= startDay),
        names,
        Infinity,
      ),
      extra.enabledCampaigns,
      servedCopy(adRows),
    ),
    displayCreatives: extra.creatives,
  };
}
