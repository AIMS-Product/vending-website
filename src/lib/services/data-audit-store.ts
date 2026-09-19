import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type { DataAuditRun } from "@/lib/services/data-audit-checks";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

/**
 * Keeps the night's verdicts. A failure to store is reported, never thrown:
 * the audit already ran, and its answers still reach the email and Slack.
 */
export async function storeAuditRun(
  run: DataAuditRun,
  client: Client = createAdminClient(),
): Promise<{ stored: boolean; error?: string }> {
  const rows = run.results.map((result) => ({
    run_at: run.runAt,
    check_id: result.checkId,
    label: result.label,
    window_label: result.window,
    source_name: result.sourceName,
    ours: result.ours,
    source: result.source,
    diff_pct: result.diffPct,
    status: result.status,
    detail: result.detail,
  }));
  const { error } = await client.from("data_audit_runs").insert(rows);
  if (error) return { stored: false, error: error.message };
  return { stored: true };
}

/**
 * Interrupts on a real disagreement only. A passing audit is silent: an alert
 * that fires every night is an alert nobody reads.
 */
export async function alertOnAuditFailure(
  run: DataAuditRun,
  fetchImpl: typeof fetch = fetch,
): Promise<{ posted: boolean; error?: string }> {
  if (run.summary.status === "pass" || run.summary.status === "skipped") {
    return { posted: false };
  }
  if (!config.SLACK_WEBHOOK_URL) {
    return { posted: false, error: "SLACK_WEBHOOK_URL is not set." };
  }
  const lines = run.summary.problems
    .slice(0, 6)
    .map(
      (problem) =>
        `• *${problem.label}* (${problem.sourceName}): ${problem.detail}`,
    );
  try {
    const response = await fetchImpl(config.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: [
          `Data check: ${run.summary.headline}`,
          ...lines,
          "Dashboard numbers built on these should wait until this is settled.",
        ].join("\n"),
      }),
    });
    if (!response.ok) {
      return { posted: false, error: `Slack replied ${response.status}.` };
    }
    return { posted: true };
  } catch (error) {
    return {
      posted: false,
      error: error instanceof Error ? error.message : "Slack post failed.",
    };
  }
}
