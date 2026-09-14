import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { resolveSetterTouch, type SetterTouch } from "@/lib/close/setter-touch";
import { setsCalls } from "@/lib/services/call-credit";
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
 * Close's lead custom field naming the setter who got this lead onto the
 * calendar -- by call, SMS or voicemail drop, never by the chat widget.
 *
 * Setters and the site chatbot share one round-robin Lane 2 calendar link, so
 * the booking URL itself carries nothing that could tell them apart. This
 * field, which the reactivation workflow already fills in, is the only record
 * of who did the work.
 */
const SETTER_NAME_FIELD = "Reactivation - Setter Name";

/**
 * Close's lead custom field for how the lead entered the system: `chatbot`,
 * `website-application`, `lead-magnet`, `webinar`, ... Entry credit only. A
 * lead tagged `chatbot` that a setter later booked keeps this tag AND gets a
 * setter name; the two never overwrite each other.
 */
const RESOURCE_TAG_FIELD = "Resource Tag";

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
  closed_won_at?: string | null;
  closed_won_source?: string | null;
};

/** Columns that predate this slice, so this select always works. */
const CLAIM_BASE_FIELDS = "id,close_lead_id,call_status" as const;

/**
 * Columns added by `20260910120000_youtube_attribution.sql`, which ships
 * un-applied like `public_request_hits` before it. Selected separately so a
 * deploy that lands ahead of the migration keeps mirroring bookings instead of
 * erroring on every row -- `call_booked_at` / `call_status` feed the "Booked"
 * number on four pre-existing analytics tabs.
 */
const CLAIM_OUTCOME_FIELDS = "closed_won_at,closed_won_source" as const;

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

  const claimed = await claimLeads(client, staleBefore, batchSize);
  const rows = claimed.rows;
  const outcomesConnected = claimed.outcomesConnected;
  if (rows.length === 0) return empty;

  // Probed once per run, not per row: a missing credit column would otherwise
  // fail all 60 updates in the batch and the whole booking mirror with them.
  const creditConnected = await columnsConnected(
    client,
    "booked_by_setter,entry_resource_tag,close_lead_created_at",
  );
  const valueConnected = await columnsConnected(client, "closed_won_value");
  const touchConnected = await columnsConnected(
    client,
    "setter_touch_name,setter_touch_at",
  );

  const result: ReconcileBookingsResult = { ...empty, scanned: rows.length };
  const reconciledAt = now.toISOString();
  let cursor = 0;

  async function worker() {
    for (;;) {
      const row = rows[cursor++];
      if (!row?.close_lead_id) return;

      try {
        const lead = await closeClient.getLead(row.close_lead_id);
        const bookedAt = lead ? parseBookedDate(lead.custom) : null;
        // Only for bookings nothing else can account for, and only once the
        // lead actually has a booking: one extra Close read per lead per pass,
        // skipped entirely when a human already named the setter or when the
        // lead never booked.
        const touch =
          touchConnected && lead && bookedAt && !statedSetter(lead.custom)
            ? await fetchSetterTouch(
                client,
                closeClient,
                row.id,
                row.close_lead_id,
              )
            : null;
        const update = lead
          ? {
              call_booked_at: bookedAt,
              call_status: lead.status_label?.trim() || null,
              call_reconciled_at: reconciledAt,
              ...(outcomesConnected ? outcomeUpdate(row, lead, now) : null),
              ...(creditConnected ? creditUpdate(lead) : null),
              // Cleared when nothing qualifies, so a touch that stops applying
              // (the booking moved, the roster changed) does not linger as
              // credit nobody can defend.
              ...(touchConnected
                ? {
                    setter_touch_name: touch?.name ?? null,
                    setter_touch_at: touch?.at ?? null,
                  }
                : null),
              // Written on every pass, outside outcomeUpdate's branching: a
              // deal re-valued in Close, or a win reversed, has to reach the
              // report, and wonValue already returns null for a lead with no
              // won opportunity.
              ...(valueConnected
                ? { closed_won_value: wonValue(lead.opportunities) }
                : null),
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
 * The batch of stale leads to re-check, tried with the outcome columns first.
 *
 * Never-checked rows sort first (`nulls first`), so a fresh deploy backfills
 * history before it starts re-checking rows it already knows about.
 *
 * `outcomesConnected: false` means the migration is not applied yet: the caller
 * must then keep the four new columns out of the write as well, or every update
 * 400s for the same reason the select did.
 */
async function claimLeads(
  client: ReconcileClient,
  staleBefore: string,
  batchSize: number,
): Promise<{ rows: LeadRow[]; outcomesConnected: boolean }> {
  const withOutcomes = await selectLeads(
    client,
    staleBefore,
    batchSize,
    `${CLAIM_BASE_FIELDS},${CLAIM_OUTCOME_FIELDS}`,
  );
  if (withOutcomes) return { rows: withOutcomes, outcomesConnected: true };

  const baseOnly = await selectLeads(
    client,
    staleBefore,
    batchSize,
    CLAIM_BASE_FIELDS,
  );
  if (baseOnly) return { rows: baseOnly, outcomesConnected: false };

  throw new Error("Could not load leads for booking reconciliation.");
}

/**
 * Returns null only for a missing-column error, so a statement timeout or a
 * transient 503 still throws rather than silently downgrading every write.
 */
async function selectLeads(
  client: ReconcileClient,
  staleBefore: string,
  batchSize: number,
  fields: string,
): Promise<LeadRow[] | null> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(fields)
    .not("close_lead_id", "is", null)
    .or(`call_reconciled_at.is.null,call_reconciled_at.lt.${staleBefore}`)
    .order("call_reconciled_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) {
    if (isMissingOutcomeColumnError(error)) return null;
    throw new Error("Could not load leads for booking reconciliation.");
  }
  return (data ?? []) as unknown as LeadRow[];
}

/**
 * Requires BOTH an undefined-column signal and one of the columns this slice
 * adds, following `chatbot/booking-attribution.ts`: a bare substring match lets
 * any unrelated error that happens to name the column read as "not migrated".
 */
function isMissingOutcomeColumnError(error: unknown): boolean {
  const { code, message } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
  };
  const text = typeof message === "string" ? message : "";
  if (
    !text.includes("closed_won_at") &&
    !text.includes("closed_won_source") &&
    !text.includes("call_outcome") &&
    !text.includes("close_status_at")
  ) {
    return false;
  }
  return (
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("42703") ||
    text.includes("does not exist") ||
    text.includes("could not find")
  );
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
  closed_won_at?: string | null;
  closed_won_source?: "close_opportunity" | "status_observed" | null;
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
    return update;
  }

  // The label has moved off won and the only date we hold is one we inferred
  // from that label. Clear it, or a corrected status leaves a permanent win on
  // the report. A close_opportunity date is left alone -- Close asserted it.
  if (
    outcome !== "won" &&
    row.closed_won_at &&
    row.closed_won_source === "status_observed"
  ) {
    update.closed_won_at = null;
    update.closed_won_source = null;
  }

  return update;
}

type CloseOpportunities =
  | Array<{
      status_type?: string | null;
      date_won?: string | null;
      /** Close returns this in cents; see wonValue. */
      value?: number | null;
    }>
  | null
  | undefined;

export function outcomeFromLabel(
  label: string | null | undefined,
): CallOutcome | null {
  if (!label) return null;
  // Drop emoji and punctuation so "🏆 Closed / Won" normalises to "closed won".
  //
  // Apostrophes are deleted rather than turned into a separator first: with a
  // blanket replace, "Won't" became "won t" and matched /\bwon\b/, so
  // "Lost - Won't Sign" was recorded as a won deal.
  const normalised = label
    .toLowerCase()
    .replace(/['‘’]/g, "")
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
  // Strictly status_type === "won": Close keeps date_won on a deal that was won
  // and later re-opened or lost, and close_opportunity is the one provenance
  // trusted to feed median cycle time. An opportunity shape with no status_type
  // is therefore not accepted either -- such a lead falls back to
  // status_observed, which the duration maths already excludes.
  const dates = opportunities
    .filter((opportunity) => opportunity?.status_type === "won")
    .map((opportunity) => opportunity?.date_won)
    .filter(
      (date): date is string =>
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date.trim()),
    )
    .map((date) => date.trim().slice(0, 10))
    .sort();
  return dates[0] ?? null;
}

/**
 * What this lead's won deals are worth, in dollars.
 *
 * Close returns `value` as an integer number of CENTS (checked against live
 * data 2026-09-11: an opportunity formatted "$5,997" comes back as 599700), so
 * it is divided here and every reader downstream sees dollars.
 *
 * Summed across won opportunities rather than taking the first, the way
 * `earliestWonDate` does: a lead that bought twice is worth both deals, while
 * the date the lead became a customer is still the first one. A won
 * opportunity with no numeric value contributes nothing, and a lead with no
 * won opportunity at all is null -- not observed, never zero.
 */
export function wonValue(opportunities: CloseOpportunities): number | null {
  if (!Array.isArray(opportunities)) return null;
  const values = opportunities
    .filter((opportunity) => opportunity?.status_type === "won")
    .map((opportunity) => opportunity?.value)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / 100;
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

/**
 * Mirrors Close's credit fields onto the lead: who booked the call, what
 * brought the person in, and when Close first created them (first-touch order).
 *
 * Written on every pass rather than only when newly set, so a setter name
 * corrected in Close (the wrong setter credited, a lead reassigned) flows
 * through instead of being frozen at whatever the first pass saw. Both are
 * cleared when Close clears them, for the same reason.
 */
function creditUpdate(lead: {
  custom?: Record<string, unknown> | null;
  date_created?: string | null;
}): {
  booked_by_setter: string | null;
  entry_resource_tag: string | null;
  close_lead_created_at: string | null;
} {
  return {
    booked_by_setter: customText(lead.custom, SETTER_NAME_FIELD),
    entry_resource_tag: customText(lead.custom, RESOURCE_TAG_FIELD),
    close_lead_created_at: lead.date_created || null,
  };
}

/**
 * One text custom field, by name. `getLead` requests `_fields=...,custom`,
 * which Close returns keyed by field NAME rather than by `cf_` id -- same
 * shape parseBookedDate above reads.
 *
 * Non-string values (a choices field that came back as a list, a number) are
 * dropped rather than coerced: a stringified array is worse than no credit.
 */
function customText(
  custom: Record<string, unknown> | null | undefined,
  field: string,
): string | null {
  const raw = custom?.[field];
  if (typeof raw !== "string") return null;
  return raw.trim() || null;
}

/**
 * Whether `20260910200000_booking_credit.sql` and
 * `20260910220000_close_lead_created_at.sql` have been applied. Migrations here
 * ship ahead of being applied by hand, and the credit columns are additive
 * polish -- losing the whole booking mirror over them would be the regression.
 */
async function columnsConnected(
  client: ReconcileClient,
  fields: string,
): Promise<boolean> {
  const { error } = await client
    .from("lead_submissions")
    .select(fields)
    .limit(1);
  return !error;
}

/** The setter a human typed into Close, if any. Its presence skips the inference. */
function statedSetter(custom: Record<string, unknown> | null | undefined) {
  return Boolean(customText(custom, SETTER_NAME_FIELD));
}

/**
 * The last setter to call or text this lead before they booked.
 *
 * Timed against Calendly's own booking timestamp, never Close's booked DATE:
 * that field carries no time, so every call made later on the booking day
 * would read as happening after it and the real setter would be skipped.
 *
 * Fail-soft on purpose: this is the weakest signal on the page, and an
 * unreachable activity list must never cost the booking mirror its pass.
 */
async function fetchSetterTouch(
  client: ReconcileClient,
  closeClient: CloseClient,
  leadSubmissionId: string,
  closeLeadId: string,
): Promise<SetterTouch | null> {
  try {
    const bookedAt = await fetchBookingTime(client, leadSubmissionId);
    if (!bookedAt) return null;
    const { data } = await closeClient.listLeadActivities(closeLeadId);
    return resolveSetterTouch(data ?? [], bookedAt, (name) => setsCalls(name));
  } catch {
    return null;
  }
}

/** When Calendly says this lead's call was booked, to the second. */
async function fetchBookingTime(
  client: ReconcileClient,
  leadSubmissionId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("calendly_bookings")
    .select("booked_at:raw_payload->payload->>created_at")
    .eq("lead_submission_id", leadSubmissionId)
    .eq("event_kind", "invitee.created")
    .order("event_start_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const row = (data ?? [])[0] as { booked_at?: string | null } | undefined;
  return row?.booked_at ?? null;
}
