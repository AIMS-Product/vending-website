import "server-only";

import { byBooker } from "@/lib/analytics/dashboard-metrics";
import { getV2Calls } from "@/lib/services/booked-calls-v2-data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  buildFunnelBoard,
  type BoardCall,
  type BoardFill,
  type FunnelBoard,
} from "@/lib/services/funnel-board";

const PAGE = 1000;
const CHUNK = 150;

const FILL_FIELDS =
  "id,created_at,email,utm_source,utm_medium,referrer,metadata,close_lead_id";

/**
 * Two weeks of calls counted on Dom's rule from `weekStart` (a Monday), by the
 * day booked, and every site form fill those leads ever made (matched by Close lead id, then email).
 * Throws on a read error: a board with a silently missing page is worse than
 * no board.
 */
export async function getFunnelBoard(weekStart: string): Promise<FunnelBoard> {
  const client = createAdminClient();
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));

  const read = await getV2Calls(days[0]!, days.at(-1)!);
  if (!read.ok) {
    console.error("[funnel-board] Dom's-rule calls read failed", read.error);
    throw new Error("Could not load booked calls.");
  }
  const calls: BoardCall[] = read.calls.map(byBooker).map((call) => ({
    lead_id: call.leadId,
    email: call.email,
    display_name: null,
    funnel: call.funnel,
    first_sales_call_booked_date: call.bookedDate,
    setter_name: call.setter,
    bookedBy: call.bookedBy ?? null,
  }));

  const byId = new Map<string, BoardFill>();
  const collect = async (
    column: "close_lead_id" | "email",
    values: string[],
  ) => {
    for (let i = 0; i < values.length; i += CHUNK) {
      const { data, error } = await client
        .from("lead_submissions")
        .select(FILL_FIELDS)
        .in(column, values.slice(i, i + CHUNK))
        .limit(PAGE);
      if (error) {
        console.error(
          `[funnel-board] lead_submissions by ${column} failed`,
          error,
        );
        throw new Error("Could not load site form fills.");
      }
      if (data.length >= PAGE) {
        throw new Error(
          "Site form fill lookup hit the row cap; narrow the chunk.",
        );
      }
      for (const row of data as (BoardFill & { id: string })[])
        byId.set(row.id, row);
    }
  };
  await collect("close_lead_id", [...new Set(calls.map((c) => c.lead_id))]);
  const emails = [
    ...new Set(
      calls
        .map((c) => c.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];
  await collect("email", emails);

  return buildFunnelBoard({ calls, fills: [...byId.values()], days });
}
