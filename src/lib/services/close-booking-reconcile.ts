import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ReconcileClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Marker written to `call_status` when Close no longer has the lead we synced.
 * Distinguishable from a real Close status label, which is always a human
 * label like "Call Booked", and keeps the row out of the retry rotation.
 */
export const CLOSE_LEAD_MISSING = "close_lead_missing";

/** Close's lead custom field holding the first booked sales call. */
const FIRST_CALL_BOOKED_FIELD = "First Call Booked Date";

/**
 * How many leads one run may check. The cron fires every 2 minutes, so this
 * drains a 500-lead backlog in well under an hour while leaving Close API
 * headroom for the lead sync that shares the same key and the same run.
 */
const DEFAULT_BATCH_SIZE = 60;

/**
 * Parallel Close reads. Close rate-limits per org, and the lead sync is calling
 * the same API in the same request, so this stays deliberately modest.
 */
const CONCURRENCY = 5;

/**
 * Rows re-checked this recently are skipped. A booked call rarely changes, but
 * status does (No Show, Canceled, Closed/Won), so nothing is ever considered
 * permanently settled -- it just falls to the back of the queue.
 */
const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

export type ReconcileBookingsResult = {
  scanned: number;
  updated: number;
  booked: number;
  missing: number;
  failed: number;
};

type LeadRow = {
  id: string;
  close_lead_id: string | null;
  /** Previous label, so a status CHANGE can be dated rather than re-stamped. */
  call_status: string | null;
  closed_won_at: string | null;
  closed_won_source: string | null;
};

/**
 * Mirrors "did this website lead go on to book a call" from Close onto our own
 * lead rows.
 *
 * Close is the source of truth rather than the Calendly webhook: it already
 * holds the full history, it covers calendars this site never renders (phone,
 * Saleskick, direct links), and we store `close_lead_id` on every synced lead
 * so the join is exact instead of an email guess. This reads Close and writes
 * only to our own table -- it never writes to the CRM.
 */
export async function reconcileCloseBookings(
  deps: {
    client?: ReconcileClient;
    closeClient?: CloseClient;
    batchSize?: number;
    now?: Date;
  } = {},
): Promise<ReconcileBookingsResult> {
  const empty: ReconcileBookingsResult = {
    scanned: 0,
    updated: 0,
    booked: 0,
    missing: 0,
    failed: 0,
  };

  if (!config.CLOSE_API_KEY) return empty;

  const client = deps.client ?? createAdminClient();
  const closeClient =
    deps.closeClient ??
    createCloseClient({
      apiKey: config.CLOSE_API_KEY,
      baseUrl: config.CLOSE_API_BASE_URL,
    });
  const now = deps.now ?? new Date();
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;

  const staleBefore = new Date(now.getTime() - RECHECK_AFTER_MS).toISOString();

  // Never-checked rows sort first (`nulls first`), so a fresh deploy backfills
  // history before it starts re-checking rows it already knows about.
  const { data, error } = await client
    .from("lead_submissions")
    .select("id,close_lead_id,call_status,closed_won_at,closed_won_source")
    .not("close_lead_id", "is", null)
    .or(`call_reconciled_at.is.null,call_reconciled_at.lt.${staleBefore}`)
    .order("call_reconciled_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) {
    throw new Error("Could not load leads for booking reconciliation.");
  }

  const rows = (data ?? []) as LeadRow[];
  if (rows.length === 0) return empty;

  const result: ReconcileBookingsResult = { ...empty, scanned: rows.length };
  const reconciledAt = now.toISOString();
  let cursor = 0;

  async function worker() {
    for (;;) {
      const row = rows[cursor++];
      if (!row?.close_lead_id) return;

      try {
        const lead = await closeClient.getLead(row.close_lead_id);
        const update = lead
          ? {
              call_booked_at: parseBookedDate(lead.custom),
              call_status: lead.status_label?.trim() || null,
              call_reconciled_at: reconciledAt,
              ...outcomeUpdate(row, lead, now),
            }
          : {
              // Leave call_booked_at untouched: a lead deleted in Close today
              // does not un-book the call it made last month.
              call_status: CLOSE_LEAD_MISSING,
              call_reconciled_at: reconciledAt,
            };

        const { error: updateError } = await client
          .from("lead_submissions")
          .update(update)
          .eq("id", row.id);

        if (updateError) {
          result.failed += 1;
          continue;
        }

        result.updated += 1;
        if (!lead) result.missing += 1;
        else if ("call_booked_at" in update && update.call_booked_at) {
          result.booked += 1;
        }
      } catch {
        // One unreachable lead must not abort the batch; the row keeps its old
        // call_reconciled_at and is picked up again on the next run.
        result.failed += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker),
  );

  return result;
}

/**
 * Close status labels that assert something specific about the call or the
 * deal, matched on the normalised label so an emoji change or a re-word does
 * not silently stop the mapping.
 *
 * Anything not listed stays `null`. "Follow Up" and "Lost" say nothing about
 * whether the call was held, and guessing either way would put a number on the
 * report that Close never asserted.
 */
const OUTCOME_PATTERNS: Array<{ test: RegExp; outcome: CallOutcome }> = [
  { test: /\bno show\b/, outcome: "no_show" },
  { test: /\bcancel(?:ed|led)?\b/, outcome: "canceled" },
  { test: /\breschedul/, outcome: "rescheduled" },
  { test: /\bcontract sent\b/, outcome: "contract_sent" },
  { test: /\bwon\b/, outcome: "won" },
];

type CallOutcome =
  "no_show" | "canceled" | "rescheduled" | "contract_sent" | "won";

type OutcomeUpdate = {
  call_outcome: CallOutcome | null;
  close_status_at?: string;
  closed_won_at?: string;
  closed_won_source?: "close_opportunity" | "status_observed";
};

/**
 * Derives the outcome columns from one Close lead read.
 *
 * Two rules matter here:
 *
 *  - `close_status_at` is only written when the label actually CHANGED, so it
 *    means "when this status began" rather than "when we last looked".
 *  - a won date from a Close opportunity always wins over one we inferred. A
 *    `status_observed` date is only ever written when nothing better exists,
 *    and it is never allowed to overwrite a real one, because the reporting
 *    deliberately excludes inferred dates from cycle-time maths.
 */
export function outcomeUpdate(
  row: Pick<LeadRow, "call_status" | "closed_won_at" | "closed_won_source">,
  lead: { status_label?: string | null; opportunities?: CloseOpportunities },
  now: Date,
): OutcomeUpdate {
  const label = lead.status_label?.trim() || null;
  const outcome = outcomeFromLabel(label);
  const update: OutcomeUpdate = { call_outcome: outcome };

  if (label !== row.call_status) {
    update.close_status_at = now.toISOString();
  }

  const wonDate = earliestWonDate(lead.opportunities);
  if (wonDate) {
    update.closed_won_at = wonDate;
    update.closed_won_source = "close_opportunity";
    return update;
  }

  // No opportunity date. Stamp today only if this lead is won and has no date
  // of any kind yet — never downgrade a real date to an observed one.
  if (
    outcome === "won" &&
    !row.closed_won_at &&
    row.closed_won_source !== "close_opportunity"
  ) {
    update.closed_won_at = dayKey(now);
    update.closed_won_source = "status_observed";
  }

  return update;
}

type CloseOpportunities =
  | Array<{ status_type?: string | null; date_won?: string | null }>
  | null
  | undefined;

export function outcomeFromLabel(
  label: string | null | undefined,
): CallOutcome | null {
  if (!label) return null;
  // Drop emoji and punctuation so "🏆 Closed / Won" normalises to "closed won".
  const normalised = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return (
    OUTCOME_PATTERNS.find((pattern) => pattern.test.test(normalised))
      ?.outcome ?? null
  );
}

/**
 * The first won date across a lead's opportunities.
 *
 * A lead can carry several; the first win is when this lead became a customer,
 * which is the event the attribution report is dating.
 */
export function earliestWonDate(
  opportunities: CloseOpportunities,
): string | null {
  if (!Array.isArray(opportunities)) return null;
  const dates = opportunities
    .filter(
      (opportunity) =>
        opportunity?.status_type === "won" || Boolean(opportunity?.date_won),
    )
    .map((opportunity) => opportunity?.date_won)
    .filter(
      (date): date is string =>
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date.trim()),
    )
    .map((date) => date.trim().slice(0, 10))
    .sort();
  return dates[0] ?? null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Close returns custom fields keyed by name when asked for the `custom` group.
 * The value is a plain `YYYY-MM-DD` date string; anything else is treated as
 * "not booked" rather than trusted into a date column.
 */
function parseBookedDate(custom: Record<string, unknown> | null | undefined) {
  const raw = custom?.[FIRST_CALL_BOOKED_FIELD];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}
