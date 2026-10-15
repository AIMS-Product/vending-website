import "server-only";

import { pacificToday } from "@/lib/admin/format-time";
import {
  readCalls,
  readDeals,
  readFacts,
} from "@/lib/services/analytics-dashboard-data";
import {
  buildGoalPlan,
  buildMarketingMtd,
  priorRange,
  type GoalPlan,
  type MarketingMtd,
  type MtdCall,
} from "@/lib/services/marketing-mtd";
import {
  buildScorecard,
  SCORECARD_FROM,
  type Scorecard,
  type WebinarEvent,
} from "@/lib/services/marketing-scorecard";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingMtdReport =
  | {
      ok: true;
      today: string;
      mtd: MarketingMtd;
      goal: GoalPlan;
      scorecard: Scorecard;
      webinars: WebinarEvent[];
      /** When the page read Close and the mirror. */
      readAt: string;
    }
  | { ok: false; error: string };

/**
 * The marketing month so far and the same dates last month, on Dom's rule.
 * Calls, spend and wins come from the main dashboard's own readers, so every
 * booked figure here is the one `/admin/analytics` and the Months V2 panel
 * show. Never throws: a failed read says so, because a page of zeros reads as
 * a bad month.
 */
export async function getMarketingMtd(
  input: { now?: Date } = {},
): Promise<MarketingMtdReport> {
  const today = pacificToday(input.now ?? new Date());
  const current = { from: `${today.slice(0, 7)}-01`, to: today };
  const from = [priorRange(current).from, SCORECARD_FROM].sort()[0]!;

  const [calls, deals, facts, webinars] = await Promise.all([
    readCalls(from, today),
    readDeals(from, today),
    readFacts(from, today),
    createAdminClient()
      .from("webinar_events")
      .select(
        "date,label,registrations,attendees,booked_calls,won,revenue,spend",
      )
      .gte("date", from)
      .lte("date", today)
      .order("date"),
  ]);
  const failed = [calls, deals, facts].find((read) => !read.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  if (!calls.ok || !deals.ok || !facts.ok) {
    return { ok: false, error: "A Close read failed." };
  }
  if (webinars.error) {
    console.error("Marketing MTD: webinar_events read failed", webinars.error);
    return { ok: false, error: "Webinar events could not be read." };
  }

  const mtdCalls: MtdCall[] = calls.data.map((call) => ({
    ...call,
    name: call.email,
  }));
  const mtd = buildMarketingMtd({
    calls: mtdCalls,
    deals: deals.data,
    spend: facts.data,
    current,
  });
  return {
    ok: true,
    today,
    mtd,
    goal: buildGoalPlan({ booked: mtd.total.current.booked, today }),
    scorecard: buildScorecard({ calls: mtdCalls, spend: facts.data, today }),
    webinars: webinars.data ?? [],
    readAt: new Date().toISOString(),
  };
}
