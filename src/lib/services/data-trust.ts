import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderMarkdown } from "@/lib/markdown";
import type { AuditStatus } from "@/lib/services/data-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

export type TrustCheck = {
  checkId: string;
  label: string;
  window: string;
  sourceName: string;
  ours: number | null;
  source: number | null;
  diffPct: number | null;
  status: AuditStatus;
  detail: string;
};

export type DataTrust = {
  /** Null when the audit has never stored a run, which is itself worth saying. */
  run: { runAt: string; checks: TrustCheck[] } | null;
  /** Rendered `REPORTING.md`. Null when it could not be read. */
  glossaryHtml: string | null;
  /** Why the glossary is missing, in words an admin can act on. */
  glossaryError: string | null;
  /** Why the checks are missing, same. */
  checksError: string | null;
};

/**
 * The provenance screen's data: last night's source comparison, and the
 * glossary that says what each number means.
 *
 * Both halves are optional and fail independently. A page that renders
 * nothing because one read failed would hide the other half, and the whole
 * point of this screen is that a missing answer is visible rather than quiet.
 */
export async function getDataTrust(
  deps: { client?: Client; glossaryPath?: string } = {},
): Promise<DataTrust> {
  const [checks, glossary] = await Promise.all([
    readLatestRun(deps.client ?? createAdminClient()),
    readGlossary(deps.glossaryPath),
  ]);
  return { ...checks, ...glossary };
}

/**
 * The newest run only. Rows are stored one per check with a shared `run_at`,
 * so the newest timestamp is read first and its checks fetched by equality
 * rather than by guessing how many checks a run contains.
 */
async function readLatestRun(
  client: Client,
): Promise<Pick<DataTrust, "run" | "checksError">> {
  const latest = await client
    .from("data_audit_runs")
    .select("run_at")
    .order("run_at", { ascending: false })
    .limit(1);
  if (latest.error) {
    return { run: null, checksError: latest.error.message };
  }
  const runAt = latest.data?.[0]?.run_at;
  if (!runAt) return { run: null, checksError: null };

  const rows = await client
    .from("data_audit_runs")
    .select(
      "check_id,label,window_label,source_name,ours,source,diff_pct,status,detail",
    )
    .eq("run_at", runAt)
    .order("check_id");
  if (rows.error) return { run: null, checksError: rows.error.message };

  const checks = (rows.data ?? []).map((row): TrustCheck => ({
    checkId: row.check_id,
    label: row.label,
    window: row.window_label,
    sourceName: row.source_name,
    ours: row.ours,
    source: row.source,
    diffPct: row.diff_pct,
    status: row.status as AuditStatus,
    detail: row.detail,
  }));
  return { run: { runAt, checks }, checksError: null };
}

/**
 * `REPORTING.md` at the repo root stays the one copy. Rendering it here rather
 * than restating it in JSX is the point: a glossary that can disagree with
 * itself is worse than no glossary.
 *
 * Nothing imports the file, so it is pulled into the deployment bundle by
 * `outputFileTracingIncludes` in `next.config.ts`. If that entry is removed
 * this read fails in production and passes locally.
 */
async function readGlossary(
  glossaryPath = path.join(process.cwd(), "REPORTING.md"),
): Promise<Pick<DataTrust, "glossaryHtml" | "glossaryError">> {
  try {
    const source = await readFile(glossaryPath, "utf8");
    // GFM: the glossary is mostly tables. Without it they render as walls of
    // pipe characters.
    return {
      glossaryHtml: await renderMarkdown(source, { gfm: true }),
      glossaryError: null,
    };
  } catch (error) {
    return {
      glossaryHtml: null,
      glossaryError:
        error instanceof Error
          ? error.message
          : "REPORTING.md could not be read.",
    };
  }
}

/** Audit verdicts to the four chip tones the admin already uses. */
export function trustTone(status: AuditStatus): "ok" | "warn" | "bad" | "idle" {
  switch (status) {
    case "pass":
      return "ok";
    case "warn":
      return "warn";
    case "fail":
    case "error":
      return "bad";
    default:
      return "idle";
  }
}

/** What the verdict means for someone about to quote the number. */
export function trustVerdict(status: AuditStatus): string {
  switch (status) {
    case "pass":
      return "Agrees with the source";
    case "warn":
      return "Close, worth a look";
    case "fail":
      return "Disagrees — do not quote";
    case "error":
      return "Could not be checked";
    default:
      return "Not connected";
  }
}
