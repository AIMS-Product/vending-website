import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  createGhlClient,
  type GhlClient,
  type GhlEmailStats,
  type GhlFormSubmission,
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
export const FORM_WINDOW_DAYS = 3;

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
        // GHL's `endAt` is exclusive: asking for the window's own last day
        // returns nothing for it. Measured live 2026-09-19 (112 submissions
        // to endAt 09-18, 129 to endAt 09-19).
        dayKey(addDays(now, 1)),
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
        : // A first snapshot has no prior to subtract, so no rows yet. Not
          // an error; text here would mark the run failed.
          null,
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

/** Forms whose submissions are webinar registrations, not new leads. */
export const WEBINAR_FORM_PATTERN = /webinar/i;

type FormRoute = {
  source: string;
  medium: string;
  content: string;
  /** A program channel the row belongs to regardless of its source. */
  channel?: string;
};

/**
 * Where each GHL form's submissions came from, by form id (names get edited;
 * ids do not). The MH and AK forms are the lead magnets Mike Hoffmann and
 * Anthony Kolodziej hand out on Instagram (confirmed by Adam, 2026-09-13).
 * The paid magnet is a Meta ad. A form not listed here stays a "GHL forms"
 * lead so a new form shows up instead of vanishing. Webinar registration
 * forms are skipped before this map applies; see WEBINAR_FORM_PATTERN.
 */
export const FORM_ROUTES: Record<string, FormRoute | "exclude"> = {
  // Mike's Instagram lead magnets.
  vig6vobsefRB3DHZZzo8: {
    source: "mike-ig",
    medium: "lead-magnet",
    content: "route-builder",
  },
  "74fUmvjrsYdkdhUZRwBn": {
    source: "mike-ig",
    medium: "lead-magnet",
    content: "90-day-checklist",
  },
  BKYECxtf3IVcpVhhZSzc: {
    source: "mike-ig",
    medium: "lead-magnet",
    content: "financial-templates",
  },
  // Anthony's Instagram lead magnets.
  lWsjML1EFRINeZtzs9ZC: {
    source: "anthony-ig",
    medium: "lead-magnet",
    content: "90-day-checklist",
  },
  "5yq7Ako7Fa2OKl9b53Er": {
    source: "anthony-ig",
    medium: "lead-magnet",
    content: "financial-templates",
  },
  // The 90 Days lead magnet bought with Meta ads.
  B45aIM2IgjOh3FD8RYrl: {
    source: "meta_ads",
    medium: "paid",
    content: "90-days-lead-magnet",
  },
  // The video sales letter funnel's opt-ins.
  uzY5o2A3dIjg6JvkDKPe: { source: "vsl", medium: "form", content: "vsl" },
  "7mfqxsL7RDAPJw7GZNoq": {
    source: "vsl",
    medium: "form",
    content: "general-vsl",
  },
  // The webinar waitlist is a Webinar-program lead, not a registration.
  LZ4wWLGozv6Gt813E3XM: {
    source: "ghl_form",
    medium: "waitlist",
    content: "waitlist",
    channel: "Webinar",
  },
  // The site's lead-scoring hand-off to a booking page.
  "0vrICJhXXOmSC9aGHj3P": {
    source: "website",
    medium: "form",
    content: "lead-scoring",
  },
  // Existing members unlocking the course are not leads.
  "7K87uNNVmBmzjuQOtUdh": "exclude",
};

/**
 * Submissions to spine rows. Webinar registration forms are already counted as
 * registrations by the vp-webinars push (channel Webinar); counting the same
 * people again here as `ghl_form` leads doubled the funnel, so they are
 * skipped. Exported so the nightly audit compares the same keys this writes.
 */
export function formSubmissionRows(
  submissions: readonly GhlFormSubmission[],
  nameById: ReadonlyMap<string, string>,
): ChannelDailyRow[] {
  return submissions
    .filter(
      (submission) =>
        !WEBINAR_FORM_PATTERN.test(nameById.get(submission.formId) ?? "") &&
        FORM_ROUTES[submission.formId] !== "exclude",
    )
    .map((submission) => {
      const route = FORM_ROUTES[submission.formId];
      const routed = route && route !== "exclude" ? route : null;
      return {
        day: submission.createdAt.slice(0, 10),
        source: routed?.source ?? "ghl_form",
        medium: routed?.medium ?? "form",
        campaign:
          slug(nameById.get(submission.formId) ?? "") || submission.formId,
        content: routed?.content ?? null,
        term: null,
        channel: routed?.channel ?? null,
        leads: 1,
      };
    });
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
  const rows = formSubmissionRows(
    submissions,
    new Map(forms.map((form) => [form.id, form.name])),
  );
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
