import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Decision } from "@/lib/booked-calls-v2/engine";
import {
  getBookedCallsV2,
  type BookedCallsV2Report,
} from "@/lib/services/booked-calls-v2-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type DecisionsClient = Pick<SupabaseClient<Database>, "from">;
type DecisionRow =
  Database["public"]["Tables"]["close_meeting_decisions"]["Insert"];

/** The sync keeps lead origins fresh for meetings this recent; older ones would read "source_unavailable". */
export const DECISION_DAYS = 70;
const UPSERT_BATCH = 500;

export function decisionRows(
  decisions: readonly Decision[],
  computedAt: string,
): DecisionRow[] {
  return decisions.map((d) => ({
    meeting_id: d.meetingId,
    lead_id: d.leadId,
    created_day: d.createdDay,
    disposition: d.disposition,
    reason: d.reason,
    booked_by: d.bookedBy,
    rule_version: d.ruleVersion,
    computed_at: computedAt,
  }));
}

/**
 * Rewrite `close_meeting_decisions` with Dom's rule over the last 70 days, so
 * readers outside this app (vp-webinars room cards) join on his decisions
 * instead of re-implementing the engine. Rows from earlier runs that this run
 * did not rewrite are pruned: the table is always one run's answer.
 */
export async function snapshotV2Decisions(
  deps: {
    client?: DecisionsClient;
    load?: (w: { from: string; to: string }) => Promise<BookedCallsV2Report>;
    now?: Date;
  } = {},
): Promise<{ rowsWritten: number }> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const load = deps.load ?? getBookedCallsV2;
  const report = await load({
    from: new Date(now.getTime() - DECISION_DAYS * 86_400_000).toISOString(),
    to: now.toISOString(),
  });
  if (!report.ok)
    throw new Error(`booked calls v2 read failed: ${report.error}`);

  const computedAt = now.toISOString();
  const rows = decisionRows(report.decisions, computedAt);
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const { error } = await client
      .from("close_meeting_decisions")
      .upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict: "meeting_id" });
    if (error)
      throw new Error(
        `close_meeting_decisions upsert failed after ${i} rows: ${error.message}`,
      );
  }
  // An empty read prunes nothing: an outage must not wipe the last good answer.
  if (rows.length > 0) {
    const { error } = await client
      .from("close_meeting_decisions")
      .delete()
      .lt("computed_at", computedAt);
    if (error)
      throw new Error(`close_meeting_decisions prune failed: ${error.message}`);
  }
  return { rowsWritten: rows.length };
}
