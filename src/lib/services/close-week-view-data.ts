import "server-only";

import { config } from "@/lib/config";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import {
  buildCloseWeeks,
  recentWeeks,
  weekEndOf,
  type CloseCall,
  type CloseWeek,
} from "@/lib/services/close-week-view";
import { createAdminClient } from "@/lib/supabase/admin";

const WEEKS = 8;
const PAGE_SIZE = 1000;

export type CloseWeekReport =
  | { ok: true; weeks: CloseWeek[]; mirrorSyncedAt: string | null }
  | { ok: false; error: string };

/**
 * The last eight Friday-to-Thursday weeks from Close. First calls come from
 * the hourly `close_lead_funnel` mirror; won deals from Close directly. Never
 * throws: a failed read says so instead of printing zeros.
 */
export async function getCloseWeekView(
  input: { now?: Date } = {},
): Promise<CloseWeekReport> {
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const weeks = recentWeeks(today, WEEKS);
  const from = weeks.at(-1)!;
  const to = weekEndOf(weeks[0]!);
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
          "lead_id,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,synced_at",
        )
        .gte("first_sales_call_booked_date", from)
        .lte("first_sales_call_booked_date", to)
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
        });
        if (!mirrorSyncedAt || row.synced_at > mirrorSyncedAt) {
          mirrorSyncedAt = row.synced_at;
        }
      }
      if ((data ?? []).length < PAGE_SIZE) break;
    }
    const deals = await fetchCloseDeals({
      from,
      to,
      close: cachedCloseReads(),
      mirror: client,
    });
    return {
      ok: true,
      weeks: buildCloseWeeks({ calls, deals, weeks, today }),
      mirrorSyncedAt,
    };
  } catch (error) {
    console.error("Close week view read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
