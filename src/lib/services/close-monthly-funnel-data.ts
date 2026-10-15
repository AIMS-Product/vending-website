import "server-only";

import { byBooker } from "@/lib/analytics/dashboard-metrics";
import { pacificToday } from "@/lib/admin/format-time";
import { config } from "@/lib/config";
import { getV2Calls } from "@/lib/services/booked-calls-v2-data";
import {
  buildCloseMonthlyFunnel,
  MONTHLY_FUNNEL_START,
  type CloseMonthlyFunnel,
} from "@/lib/services/close-monthly-funnel";
import { getMonthlyLeads } from "@/lib/services/close-monthly-leads";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";

export type CloseMonthlyReport =
  | {
      ok: true;
      funnel: CloseMonthlyFunnel;
      /** Newest `synced_at` in the mirror, so the page can date itself. */
      mirrorSyncedAt: string | null;
      /** Why the Leads column is missing, when it is. */
      leadsError: string | null;
      from: string;
      to: string;
    }
  | { ok: false; error: string };

/**
 * Every call counted on Dom's rule since `MONTHLY_FUNNEL_START` (`getV2Calls`,
 * the dashboard's read), and the deals won each month, bucketed by month.
 *
 * Reads its own window rather than slicing the week view's eight weeks: this
 * one answers a different question and should not go wrong when that one's
 * length changes.
 *
 * Never throws. A failed read comes back as `ok: false`, because a grid of
 * zeros reads as a terrible year rather than a broken query.
 */
export async function getCloseMonthlyFunnel(
  input: { now?: Date; start?: string } = {},
): Promise<CloseMonthlyReport> {
  const today = pacificToday(input.now ?? new Date());
  const start = input.start ?? MONTHLY_FUNNEL_START;
  const from = `${start}-01`;
  if (!config.CLOSE_API_KEY) {
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  }
  const client = createAdminClient();
  try {
    const read = await getV2Calls(from, today);
    if (!read.ok) throw new Error(read.error);
    const calls = read.calls.map(byBooker);
    const mirrorSyncedAt = read.syncedAt;
    const deals = await fetchCloseDeals({
      from,
      to: today,
      close: cachedCloseReads(),
      mirror: client,
    });

    // Close holds only people who booked, so form fills come from our own
    // table. A failure here must not take the grid down with it: the other
    // five columns are still true, and a missing Leads column says so.
    let leads: Awaited<ReturnType<typeof getMonthlyLeads>> | null = null;
    let leadsError: string | null = null;
    try {
      leads = await getMonthlyLeads(client, { from, to: today });
    } catch (error) {
      leadsError =
        error instanceof Error
          ? error.message
          : "lead_submissions read failed.";
      console.error("Monthly funnel leads read failed", error);
    }

    return {
      ok: true,
      funnel: buildCloseMonthlyFunnel({
        calls,
        today,
        start,
        leads: leads?.byFunnel,
        leadsFrom: leads?.from ?? null,
        deals,
      }),
      mirrorSyncedAt,
      leadsError,
      from,
      to: today,
    };
  } catch (error) {
    console.error("Close monthly funnel read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
