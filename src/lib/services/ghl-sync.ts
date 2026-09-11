import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  createGhlClient,
  type GhlClient,
  type GhlEmailStats,
} from "@/lib/ghl/client";
import {
  recordSyncRun,
  upsertChannelDaily,
  type ChannelDailyRow,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

export const GHL_CONNECTORS = {
  email: "ghl-email",
  forms: "ghl-forms",
} as const;

/**
 * Form submissions re-read a short trailing window like GA4; `days` widens it
 * once for a backfill. Email stats cannot be backfilled: GHL only exposes
 * lifetime totals, so history starts the day after the first snapshot.
 */
const FORM_WINDOW_DAYS = 3;

export type GhlSyncResult = { endDate: string; connectors: SyncRunOutcome[] };

export async function syncGhl(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    ghl?: GhlClient | null;
    now?: Date;
    days?: number;
  } = {},
): Promise<GhlSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const ghl = deps.ghl === undefined ? ghlFromConfig() : deps.ghl;
  const endDate = dayKey(now);

  const connectors: SyncRunOutcome[] = [];
  connectors.push(
    await recordSyncRun(client, GHL_CONNECTORS.email, () =>
      syncEmail(client, ghl, now),
    ),
  );
  connectors.push(
    await recordSyncRun(client, GHL_CONNECTORS.forms, () =>
      syncForms(
        client,
        ghl,
        dayKey(addDays(now, -(deps.days ?? FORM_WINDOW_DAYS))),
        endDate,
        now,
      ),
    ),
  );
  return { endDate, connectors };
}

type Snapshot = Pick<
  Tables<"ghl_email_stats">,
  | "snapshot_day"
  | "workflow_id"
  | "workflow_name"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
>;

async function syncEmail(client: SyncClient, ghl: GhlClient | null, now: Date) {
  if (!ghl) return skipped("GHL_API_KEY / GHL_LOCATION_ID are not configured.");
  const today = dayKey(now);
  const workflows = await ghl.listWorkflows();

  const snapshots: Snapshot[] = [];
  // Sequential: GHL's burst limit is 100 requests per 10 seconds.
  for (const workflow of workflows) {
    const stats = await ghl.fetchWorkflowEmailStats(workflow.id);
    snapshots.push({
      snapshot_day: today,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      ...stats,
    });
  }
  if (snapshots.length === 0) return { rowsWritten: 0 };

  const { error } = await client.from("ghl_email_stats").upsert(
    snapshots.map((row) => ({ ...row, synced_at: now.toISOString() })),
    { onConflict: "snapshot_day,workflow_id" },
  );
  if (error) throw new Error(`ghl_email_stats upsert failed: ${error.message}`);

  const { data: priorRows, error: priorError } = await client
    .from("ghl_email_stats")
    .select(
      "snapshot_day,workflow_id,workflow_name,sent,delivered,opened,clicked,replied",
    )
    .lt("snapshot_day", today)
    .order("snapshot_day", { ascending: false })
    // Enough for the newest prior snapshot of every workflow across a year of daily runs.
    .limit(20_000);
  if (priorError)
    throw new Error(`ghl_email_stats read failed: ${priorError.message}`);

  const rows = emailDeltaRows(
    snapshots,
    (priorRows ?? []) as Snapshot[],
    dayKey(addDays(now, -1)),
  );
  const result = await upsertChannelDaily(client, rows, { now });
  return {
    rowsWritten: snapshots.length + result.written,
    error:
      result.failed > 0
        ? `${result.failed} channel_daily rows failed to write; see the server log.`
        : rows.length === 0
          ? "First snapshot stored; day-over-day rows start tomorrow."
          : null,
  };
}

/**
 * Today's cumulative totals minus the newest earlier snapshot per workflow,
 * credited to yesterday (the day a 11:20Z-to-11:20Z diff mostly covers).
 * A workflow with no earlier snapshot writes nothing. A metric that went down
 * (GHL corrected a total) is left unobserved rather than written negative.
 */
export function emailDeltaRows(
  today: Snapshot[],
  prior: Snapshot[],
  creditDay: string,
): ChannelDailyRow[] {
  const newestPrior = new Map<string, Snapshot>();
  for (const row of prior) {
    const existing = newestPrior.get(row.workflow_id);
    if (!existing || row.snapshot_day > existing.snapshot_day) {
      newestPrior.set(row.workflow_id, row);
    }
  }
  const rows: ChannelDailyRow[] = [];
  for (const snapshot of today) {
    const before = newestPrior.get(snapshot.workflow_id);
    if (!before) continue;
    const delta = (key: keyof GhlEmailStats) => {
      const diff = snapshot[key] - before[key];
      return diff < 0 ? null : diff;
    };
    rows.push({
      day: creditDay,
      source: "ghl_email",
      medium: "email",
      campaign: slug(snapshot.workflow_name) || snapshot.workflow_id,
      content: null,
      term: null,
      impressions: delta("sent"),
      clicks: delta("clicked"),
    });
  }
  return rows;
}

/** GHL lander form submissions as leads, by form, by the day they arrived. */
async function syncForms(
  client: SyncClient,
  ghl: GhlClient | null,
  startAt: string,
  endAt: string,
  now: Date,
) {
  if (!ghl) return skipped("GHL_API_KEY / GHL_LOCATION_ID are not configured.");
  const [forms, submissions] = await Promise.all([
    ghl.listForms(),
    ghl.fetchFormSubmissions({ startAt, endAt }),
  ]);
  const nameById = new Map(forms.map((form) => [form.id, form.name]));
  const rows: ChannelDailyRow[] = submissions.map((submission) => ({
    day: submission.createdAt.slice(0, 10),
    source: "ghl_form",
    medium: "form",
    campaign: slug(nameById.get(submission.formId) ?? "") || submission.formId,
    content: null,
    term: null,
    leads: 1,
  }));
  const result = await upsertChannelDaily(client, rows, { now });
  return {
    rowsWritten: result.written,
    error:
      result.failed > 0
        ? `${result.failed} rows failed to write; see the server log.`
        : null,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ghlFromConfig(): GhlClient | null {
  if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) return null;
  return createGhlClient({
    apiKey: config.GHL_API_KEY,
    locationId: config.GHL_LOCATION_ID,
  });
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
