import "server-only";

import { z } from "zod";
import { formatPacificStampShort, pacificToday } from "@/lib/admin/format-time";
import { byBooker } from "@/lib/analytics/dashboard-metrics";
import { config } from "@/lib/config";
import { getV2Calls } from "@/lib/services/booked-calls-v2-data";
import {
  buildCloseMtdFunnel,
  type CloseMtdFunnel,
  type CompanyMtdTotals,
} from "@/lib/services/close-mtd-funnel";
import type { CloseCall } from "@/lib/services/close-week-view";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

/** The company MTD dashboard's own numbers for the month, or why they are missing. */
export type CompanyMtdRead =
  | { ok: true; totals: CompanyMtdTotals }
  | { ok: false; error: string };

export type CloseMtdReport =
  | {
      ok: true;
      funnel: CloseMtdFunnel;
      mirrorSyncedAt: string | null;
      company: CompanyMtdRead;
    }
  | { ok: false; error: string };

/** The dashboard publishes each month's totals as static JSON beside its pages. */
const COMPANY_MTD_URL = (month: string) =>
  `https://aims-product.github.io/mtd-funnel-dashboard/archives/data-${month}.json`;

const companyMtdSchema = z.object({
  month_key: z.string(),
  grand: z.object({
    booked: z.number(),
    showed: z.number(),
    qualified: z.number(),
    closed: z.number(),
    revenue: z.number(),
  }),
});

/**
 * Reads the company MTD dashboard's totals for `month` (YYYY-MM). Not cached
 * on our side: a cached copy served stale is how the Oct 13 audit compared
 * against a build three rebuilds old. Never throws: an unreachable dashboard
 * is reported, not read as a mismatch.
 */
export async function fetchCompanyMtd(month: string): Promise<CompanyMtdRead> {
  try {
    const response = await fetch(COMPANY_MTD_URL(month), {
      cache: "no-store",
      // A stalled GitHub Pages must not hold the Months page or the audit.
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { ok: false, error: `MTD dashboard answered ${response.status}.` };
    }
    const parsed = companyMtdSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.month_key !== month) {
      return {
        ok: false,
        error: "MTD dashboard data was not in the expected shape.",
      };
    }
    const { grand } = parsed.data;
    return {
      ok: true,
      totals: {
        booked: grand.booked,
        showed: grand.showed,
        qualified: grand.qualified,
        won: grand.closed,
        revenue: grand.revenue,
      },
    };
  } catch (error) {
    console.error("Company MTD dashboard read failed", error);
    return { ok: false, error: "MTD dashboard could not be reached." };
  }
}

const MTD_COMMITS_URL = (month: string) =>
  `https://api.github.com/repos/AIMS-Product/mtd-funnel-dashboard/commits?path=archives/data-${month}.json&per_page=1`;

const mtdCommitsSchema = z
  .array(
    z.object({
      commit: z.object({ committer: z.object({ date: z.string() }) }),
    }),
  )
  .min(1);

/**
 * When the MTD dashboard last rebuilt `month`: the last commit to its data
 * file. It rebuilds from a local machine, irregularly (gaps of hours
 * overnight). Never throws: null when GitHub cannot say.
 */
// ponytail: a rebuild that changes no number makes no commit, so a quiet spell
// reads as stale and skips a comparison that would have passed. Ask Dom to
// publish a built_at in data-YYYY-MM.json if that skips too often.
export async function fetchCompanyMtdBuiltAt(
  month: string,
): Promise<string | null> {
  try {
    const response = await fetch(MTD_COMMITS_URL(month), {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`MTD build time: GitHub answered ${response.status}`);
      return null;
    }
    const parsed = mtdCommitsSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.error("MTD build time: unexpected GitHub response shape");
      return null;
    }
    return parsed.data[0]!.commit.committer.date;
  } catch (error) {
    console.error("MTD build time read failed", error);
    return null;
  }
}

const MAX_MTD_LAG_MS = 2 * 60 * 60 * 1000;

/**
 * The MTD numbers, unless the dashboard last rebuilt more than two hours
 * before our mirror synced: then a gap is its staleness, not a disagreement,
 * so say it was not compared. An unknown build time keeps the comparison.
 */
export function compareWhenFresh(
  company: CompanyMtdRead,
  builtAt: string | null,
  mirrorSyncedAt: string | null,
): CompanyMtdRead {
  if (!company.ok || !builtAt || !mirrorSyncedAt) return company;
  const lag = Date.parse(mirrorSyncedAt) - Date.parse(builtAt);
  if (!(lag > MAX_MTD_LAG_MS)) return company;
  return {
    ok: false,
    error: `MTD dashboard last rebuilt ${formatPacificStampShort(builtAt)}`,
  };
}

/** First day of `day`'s month. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/**
 * The month so far from the Close mirror, read on its own window rather than
 * sliced out of the week view's eight weeks: the two views answer different
 * questions and a shared read would tie this one's correctness to how many
 * weeks that one happens to show.
 *
 * Never throws. A failed read says so, because a funnel of zeros looks like a
 * bad month rather than a bad query.
 */
export async function getCloseMtdFunnel(
  input: { now?: Date } = {},
): Promise<CloseMtdReport> {
  // Pacific, the day Close and the MTD dashboard both count in.
  const today = pacificToday(input.now ?? new Date());
  const from = monthStart(today);
  if (!config.CLOSE_API_KEY) {
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  }
  const client = createAdminClient();
  try {
    const calls: CloseCall[] = [];
    let mirrorSyncedAt: string | null = null;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from("close_lead_funnel")
        .select(
          "lead_id,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,synced_at,lead_owner,business_line",
        )
        .gte("first_sales_call_booked_date", from)
        .lte("first_sales_call_booked_date", today)
        .order("lead_id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error)
        throw new Error(`close_lead_funnel read failed: ${error.message}`);
      for (const row of data ?? []) {
        if (!row.first_sales_call_booked_date) continue;
        calls.push({
          leadId: row.lead_id,
          funnel: row.funnel,
          status: row.status_label,
          bookedDate: row.first_sales_call_booked_date,
          showUp: row.first_call_show_up,
          qualified: row.qualified,
          leadOwner: row.lead_owner,
          businessLine: row.business_line,
        });
        if (!mirrorSyncedAt || row.synced_at > mirrorSyncedAt) {
          mirrorSyncedAt = row.synced_at;
        }
      }
      if ((data ?? []).length < PAGE_SIZE) break;
    }
    const [deals, company, builtAt] = await Promise.all([
      fetchCloseDeals({
        from,
        to: today,
        close: cachedCloseReads(),
        mirror: client,
      }),
      fetchCompanyMtd(today.slice(0, 7)),
      fetchCompanyMtdBuiltAt(today.slice(0, 7)),
    ]);
    // Until the sync has filled "Lead Owner", the roster cut is empty and
    // would read as a mismatch; say it is not compared yet instead.
    const ownersMirrored = calls.some((call) => call.leadOwner);
    return {
      ok: true,
      funnel: buildCloseMtdFunnel({ calls, deals, from, to: today }),
      mirrorSyncedAt,
      company: ownersMirrored
        ? compareWhenFresh(company, builtAt, mirrorSyncedAt)
        : {
            ok: false,
            error: "lead owners are not in our copy of Close yet.",
          },
    };
  } catch (error) {
    console.error("Close MTD funnel read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}

/**
 * The month so far on Dom's rule for the Months page: his counted meetings
 * (`getV2Calls`, the dashboard's read) through `byBooker`, and the month's
 * won deals. Never throws.
 */
export async function getDomMtdFunnel(
  input: { now?: Date } = {},
): Promise<CloseMtdReport> {
  const today = pacificToday(input.now ?? new Date());
  const from = monthStart(today);
  if (!config.CLOSE_API_KEY) {
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  }
  try {
    const [read, deals] = await Promise.all([
      getV2Calls(from, today),
      fetchCloseDeals({
        from,
        to: today,
        close: cachedCloseReads(),
        mirror: createAdminClient(),
      }),
    ]);
    if (!read.ok) throw new Error(read.error);
    return {
      ok: true,
      funnel: buildCloseMtdFunnel({
        calls: read.calls.map(byBooker),
        deals,
        from,
        to: today,
        rule: "dom",
      }),
      mirrorSyncedAt: read.syncedAt,
      company: {
        ok: false,
        error: "the company MTD dashboard counts first calls.",
      },
    };
  } catch (error) {
    console.error("Dom's-rule MTD funnel read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
