import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBookedPeople,
  type AdDayRow,
  type ContactFactsRow,
  type BookedPeople,
  type FunnelRow,
  type SubmissionRow,
} from "@/lib/services/google-ads-booked-people";
import { getBookedCallsV2 } from "@/lib/services/booked-calls-v2-data";
import { googleAdsWindow } from "@/lib/services/google-ads-dashboard";
import type { AdminAnalyticsRangeKey } from "@/lib/services/admin-analytics-range";
import { readAllPages, type PageError } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";

export type BookedPeopleRead =
  | ({ ok: true; ruleVersion: string } & BookedPeople)
  | { ok: false; error: string };

/** Lead facts are kept 70 days; a window past them reads as incomplete. */
export const MAX_PEOPLE_DAYS = 60;
const IN_BATCH = 100;
/** How far back an ad's clicks can still explain a lead in the window. */
const AD_LOOKBACK_MS = 120 * 86_400_000;

const SUBMISSION_COLUMNS =
  "close_lead_id, full_name, created_at, utm_campaign, utm_term, utm_content, qualification_summary, gclid:metadata->paid_attribution->>gclid";

function required<T>(
  label: string,
  read: { rows: T[]; error: PageError | null },
): T[] {
  if (read.error) {
    console.error(`google ads people: ${label} read failed`, read.error);
    throw new Error(`Could not read ${label}.`);
  }
  return read.rows;
}

const FUNNEL_COLUMNS =
  "lead_id, display_name, first_sales_call_booked_date, first_call_show_up, qualified, status_label, entry_source, lead_source";

/** Forms, Close leads and ad names for these leads. Throws a user-safe error. */
export async function readPeopleSources(
  leadIds: readonly string[],
  start: Date,
) {
  const db = createAdminClient();
  const submissions: SubmissionRow[] = [];
  const funnel: FunnelRow[] = [];
  const contacts: ContactFactsRow[] = [];
  for (let i = 0; i < leadIds.length; i += IN_BATCH) {
    const ids = leadIds.slice(i, i + IN_BATCH);
    const [forms, leads, facts] = await Promise.all([
      readAllPages<SubmissionRow>((a, b, count) =>
        db
          .from("lead_submissions")
          .select(SUBMISSION_COLUMNS, { count })
          .in("close_lead_id", ids)
          .order("id")
          .range(a, b),
      ),
      readAllPages<FunnelRow>((a, b, count) =>
        db
          .from("close_lead_funnel")
          .select(FUNNEL_COLUMNS, { count })
          .in("lead_id", ids)
          .order("lead_id")
          .range(a, b),
      ),
      readAllPages<ContactFactsRow>((a, b, count) =>
        db
          .from("close_meeting_leads")
          .select("lead_id, resource_tag, contact_utms", { count })
          .in("lead_id", ids)
          .order("lead_id")
          .range(a, b),
      ),
    ]);
    submissions.push(...required("site forms", forms));
    funnel.push(...required("Close leads", leads));
    contacts.push(...required("Close contact tags", facts));
  }

  // The google_ads_* views are not in the generated types.
  const views = db as unknown as SupabaseClient;
  const since = new Date(start.getTime() - AD_LOOKBACK_MS)
    .toISOString()
    .slice(0, 10);
  const [adDays, campaignDays] = await Promise.all([
    readAllPages<AdDayRow>((a, b, count) =>
      views
        .from("google_ads_ad_daily")
        .select(
          "day, campaign_id, ad_group_id, ad_group_name, ad_id, headlines, clicks",
          { count },
        )
        .gte("day", since)
        .order("day")
        .order("ad_id")
        .range(a, b),
    ),
    readAllPages<{ campaign_id: string; campaign_name: string | null }>(
      (a, b, count) =>
        views
          .from("google_ads_campaign_daily")
          .select("campaign_id, campaign_name", { count })
          .gte("day", since)
          .order("day")
          .order("campaign_id")
          .range(a, b),
    ),
  ]);
  return {
    submissions,
    funnel,
    contacts,
    adDays: required("ads", adDays),
    campaignNames: new Map(
      required("campaigns", campaignDays).flatMap((r) =>
        r.campaign_name ? [[r.campaign_id, r.campaign_name] as const] : [],
      ),
    ),
  };
}

export async function getGoogleAdsBookedPeople(
  range: AdminAnalyticsRangeKey,
  now = new Date(),
): Promise<BookedPeopleRead> {
  const { start, endsAt, days } = googleAdsWindow(range, now);
  if (days > MAX_PEOPLE_DAYS)
    return {
      ok: false,
      error: `Pick ${MAX_PEOPLE_DAYS} days or less to see the people.`,
    };
  const from = start.toISOString();
  const to = endsAt.toISOString();
  try {
    const report = await getBookedCallsV2({ from, to });
    if (!report.ok) return { ok: false, error: report.error };

    const db = createAdminClient();
    const headline = required(
      "ad-click leads",
      await readAllPages<SubmissionRow>((a, b, count) =>
        db
          .from("lead_submissions")
          .select(SUBMISSION_COLUMNS, { count })
          .gte("created_at", from)
          .lte("created_at", to)
          .not("metadata->paid_attribution->>gclid", "is", null)
          .not("call_booked_at", "is", null)
          .order("created_at")
          .range(a, b),
      ),
    );
    // One person per click, as the headline counts them.
    const byGclid = new Map(headline.map((r) => [r.gclid, r]));
    const leadIds = [
      ...new Set([
        ...report.decisions
          .filter((d) => d.origin.source === "Google Ads")
          .map((d) => d.leadId),
        ...headline.flatMap((r) => r.close_lead_id ?? []),
      ]),
    ];
    return {
      ok: true,
      ruleVersion: report.ruleVersion,
      ...buildBookedPeople({
        decisions: report.decisions,
        meetings: report.meetings,
        ...(await readPeopleSources(leadIds, start)),
        headlineLeads: [...byGclid.values()],
        now,
      }),
    };
  } catch (error) {
    console.error("google ads people: read failed", error);
    return { ok: false, error: "Could not load the people booked." };
  }
}
