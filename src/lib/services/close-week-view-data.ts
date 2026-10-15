import "server-only";

import { byBooker } from "@/lib/analytics/dashboard-metrics";
import { pacificToday } from "@/lib/admin/format-time";
import { config } from "@/lib/config";
import { getV2Calls } from "@/lib/services/booked-calls-v2-data";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import {
  buildCloseWeeks,
  recentWeeks,
  weekEndOf,
  type CloseWeek,
} from "@/lib/services/close-week-view";
import { createAdminClient } from "@/lib/supabase/admin";

const WEEKS = 8;

export type CloseWeekReport =
  | { ok: true; weeks: CloseWeek[]; mirrorSyncedAt: string | null }
  | { ok: false; error: string };

/**
 * The last eight Friday-to-Thursday weeks from Close on Dom's rule: his
 * counted meetings (`getV2Calls`, the dashboard's read); won deals from Close
 * directly. Never throws: a failed read says so instead of printing zeros.
 */
export async function getCloseWeekView(
  input: { now?: Date } = {},
): Promise<CloseWeekReport> {
  const today = pacificToday(input.now ?? new Date());
  const weeks = recentWeeks(today, WEEKS);
  const from = weeks.at(-1)!;
  const to = weekEndOf(weeks[0]!);
  if (!config.CLOSE_API_KEY) {
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  }
  const client = createAdminClient();
  try {
    const read = await getV2Calls(from, to);
    if (!read.ok) throw new Error(read.error);
    const calls = read.calls.map(byBooker);
    const mirrorSyncedAt = read.syncedAt;
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
