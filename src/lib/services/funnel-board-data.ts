import "server-only";

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
 * Two weeks of Close first calls from `weekStart` (a Monday), and every site
 * form fill those leads ever made (matched by Close lead id, then email).
 * Throws on a read error: a board with a silently missing page is worse than
 * no board.
 */
export async function getFunnelBoard(weekStart: string): Promise<FunnelBoard> {
  const client = createAdminClient();
  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));

  const calls: BoardCall[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("close_lead_funnel")
      .select(
        "lead_id,email,display_name,funnel,first_sales_call_booked_date,setter_name",
      )
      .gte("first_sales_call_booked_date", days[0]!)
      .lte("first_sales_call_booked_date", days.at(-1)!)
      .order("lead_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[funnel-board] close_lead_funnel read failed", error);
      throw new Error("Could not load Close first calls.");
    }
    calls.push(...(data as BoardCall[]));
    if (data.length < PAGE) break;
  }

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
