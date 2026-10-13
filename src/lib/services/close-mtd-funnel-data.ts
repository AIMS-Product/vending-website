import "server-only";

import { z } from "zod";
import { pacificToday } from "@/lib/admin/format-time";
import { config } from "@/lib/config";
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
  { ok: true; totals: CompanyMtdTotals } | { ok: false; error: string };

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
 * Reads the company MTD dashboard's totals for `month` (YYYY-MM). It rebuilds
 * every 15 minutes, so a short cache keeps the comparison honest. Never
 * throws: an unreachable dashboard is reported, not read as a mismatch.
 */
export async function fetchCompanyMtd(month: string): Promise<CompanyMtdRead> {
  try {
    const response = await fetch(COMPANY_MTD_URL(month), {
      next: { revalidate: 900 },
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
    const [deals, company] = await Promise.all([
      fetchCloseDeals({
        from,
        to: today,
        close: cachedCloseReads(),
        mirror: client,
      }),
      fetchCompanyMtd(today.slice(0, 7)),
    ]);
    // Until the sync has filled "Lead Owner", the roster cut is empty and
    // would read as a mismatch; say it is not compared yet instead.
    const ownersMirrored = calls.some((call) => call.leadOwner);
    return {
      ok: true,
      funnel: buildCloseMtdFunnel({ calls, deals, from, to: today }),
      mirrorSyncedAt,
      company: ownersMirrored
        ? company
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
