import "server-only";

import { createCloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import {
  buildCloseMtdFunnel,
  type CloseMtdFunnel,
} from "@/lib/services/close-mtd-funnel";
import type { CloseCall } from "@/lib/services/close-week-view";
import { fetchCloseDeals } from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

export type CloseMtdReport =
  | { ok: true; funnel: CloseMtdFunnel; mirrorSyncedAt: string | null }
  | { ok: false; error: string };

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
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
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
          "lead_id,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,synced_at",
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
      to: today,
      close: createCloseClient({ apiKey: config.CLOSE_API_KEY }),
      mirror: client,
    });
    return {
      ok: true,
      funnel: buildCloseMtdFunnel({ calls, deals, from, to: today }),
      mirrorSyncedAt,
    };
  } catch (error) {
    console.error("Close MTD funnel read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
