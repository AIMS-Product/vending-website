import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloseClient } from "@/lib/close/client";
import { isDuplicateDedupeError } from "@/lib/close/dedupe";
import { config } from "@/lib/config";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import { hasCalendlyBooking } from "@/lib/services/calendly-booking-check";
import { jsonObjectAt, jsonStringAt } from "@/lib/json-access";
import type { Database, Json, Tables } from "@/types/database";

/**
 * "They contacted us and did not book" -> a real incoming Email Activity on the
 * Close lead.
 *
 * WHY THIS EXISTS. Stephen's smart list "L2 - Warm Reply - TODAY" is a saved
 * search, not a container: no API call can put a record in it. It matches leads
 * that have an SMS, Email or Call activity with Direction = Incoming created
 * within one day. It does not look at tags or at custom fields. A website form
 * or a chatbot capture creates a Close lead and a contact and logs NO activity,
 * which is the whole reason none of our leads have ever surfaced there. Tagging
 * cannot fix it. Only an activity can.
 *
 * WHY IT IS HONEST. The visitor did contact us: they typed their details into
 * our form or told the chatbot. The activity carries what they actually
 * submitted, not a synthetic placeholder.
 *
 * WHY IT IS DELAYED. Fifty of 301 recent bookings happened within two minutes
 * of the form, straight through the Calendly redirect. Logging at submit time
 * would drop every one of those people into a same-day setter list they had
 * already booked out of, and the setters would stop trusting the list inside a
 * week. So the job is queued for capture + 15 minutes and re-checks "still
 * unbooked" at drain time, not at enqueue time.
 *
 * WHY THERE IS NO NEW CRON OR DELIVERY PATH. `close_sync_events.next_retry_at`
 * already gates the drain (see listDueCloseSyncEvents), so a future
 * next_retry_at IS the delay, served by the existing 2-minute close-sync cron.
 * The outbox also brings dedupe, retry, and needs_review parking for free.
 *
 * WHAT THIS MUST NEVER WRITE: `Recapture State`, `Ever Had Call`, or
 * `entry_source`. Stephen's Lane 2 automation owns the first two and computes
 * them FROM the activity written here; writing them changes which leads that
 * automation calls. `entry_source` is a strict `choices` field that 400s the
 * whole update. This module only ever POSTs an activity.
 */

/**
 * The gap between capture and the activity. Measured, not guessed: 50 of 301
 * bookings land inside 2 minutes and 72 inside 15, after which the curve
 * flattens hard and 70% of eventual bookings happen more than 24h out. Fifteen
 * minutes clears the straight-through cohort without stalling the chase.
 */
export const WARM_REPLY_DELAY_MINUTES = 15;

/**
 * Stays a string in config.ts on purpose: closeConfigFromEnv() takes the whole
 * config object as a flat string map, and a boolean member breaks that call for
 * every Close consumer. Read it here instead, in the one place that cares.
 */
export function isWarmReplyActivityEnabled(): boolean {
  return config.CLOSE_WARM_REPLY_ACTIVITY_ENABLED === "true";
}

type WarmReplyClient = Pick<SupabaseClient<Database>, "from">;
type CloseSyncEventInsert =
  Database["public"]["Tables"]["close_sync_events"]["Insert"];
type CloseSyncEventRow = Tables<"close_sync_events">;
type LeadRow = Tables<"lead_submissions">;

/**
 * One activity per lead, forever. Keyed on the lead alone for the same reason
 * leadCreateOrUpdateDedupeKey is (see dedupe.ts): a visitor who submits twice
 * reuses the same lead row, and a key that varied per session or per attempt
 * would let a second activity through. A duplicate incoming activity re-warms a
 * lead that has gone cold and drops it back into a same-day SLA list it has
 * already left, which is worse than never logging one at all.
 */
export function warmReplyActivityDedupeKey(leadSubmissionId: string): string {
  return `warm_reply_activity:${leadSubmissionId}`;
}

/**
 * The string embedded in the Close activity body so it is never posted twice.
 *
 * Keyed on the CLOSE lead id, which is the object the smart list actually
 * matches, rather than on our lead_submissions row. Several of our rows map to
 * one Close lead (see the call site), so a row-keyed marker would let one person
 * collect one incoming activity per row.
 */
export function warmReplyActivityMarker(closeLeadId: string): string {
  return `vp-warm-reply-ref:${closeLeadId}`;
}

export type QueueWarmReplyActivityInput = {
  leadSubmissionId: string;
  sessionId?: string | null;
  closeLeadId?: string | null;
  closeContactId?: string | null;
  /** Where the capture happened, for the activity body. */
  source: "public_lead_form" | "chatbot" | "qualification_intake";
  fullName: string | null;
  email: string;
  phone: string | null;
  sourcePath: string | null;
  message: string | null;
  /** Capture time. The job becomes due 15 minutes after this. */
  capturedAt: Date;
};

export type QueueWarmReplyActivityResult =
  | "queued"
  | "exists"
  | "disabled"
  | "failed";

/**
 * Queues the activity for capture + 15 minutes. Called from the lead-creation
 * path, so it is fail-soft to the point of paranoia: it swallows every error and
 * never throws. Two concrete reasons, not defensive habit --
 *
 * 1. The `warm_reply_activity` event_type needs a CHECK-constraint migration
 *    that is hand-applied to prod. Before it is applied the insert fails, and a
 *    thrown error here would fail real lead submissions for a follow-up job.
 * 2. Nothing about this is worth losing a lead over. The lead is already stored
 *    and already queued to Close by the time this runs.
 */
export async function queueWarmReplyActivity(
  client: WarmReplyClient,
  input: QueueWarmReplyActivityInput,
  deps: { enabled?: boolean } = {},
): Promise<QueueWarmReplyActivityResult> {
  if (!(deps.enabled ?? isWarmReplyActivityEnabled())) return "disabled";

  const dueAt = new Date(
    input.capturedAt.getTime() + WARM_REPLY_DELAY_MINUTES * 60_000,
  );

  const event: CloseSyncEventInsert = {
    lead_submission_id: input.leadSubmissionId,
    session_id: input.sessionId ?? null,
    event_type: "warm_reply_activity",
    status: "pending",
    dedupe_key: warmReplyActivityDedupeKey(input.leadSubmissionId),
    next_retry_at: dueAt.toISOString(),
    close_lead_id: input.closeLeadId ?? null,
    close_contact_id: input.closeContactId ?? null,
    payload: {
      source: input.source,
      captured_at: input.capturedAt.toISOString(),
      contact: {
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
      },
      submission: {
        source_path: input.sourcePath,
        message: input.message,
      },
    } satisfies Json,
  };

  try {
    const { error } = await client
      .from("close_sync_events")
      .insert(event)
      .select("id")
      .single();

    if (!error) return "queued";
    // A duplicate means this lead's activity is already queued -- a re-submit,
    // not a failure.
    if (isDuplicateDedupeError(error)) return "exists";
    console.warn("close sync: could not queue warm reply activity", {
      leadSubmissionId: input.leadSubmissionId,
      code: error.code,
    });
    return "failed";
  } catch (error) {
    console.warn("close sync: could not queue warm reply activity", {
      leadSubmissionId: input.leadSubmissionId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

/**
 * Drain handler. Returns the Close ids so the outbox marks the event `synced`.
 *
 * A lead that booked in the meantime, or a flag that has been switched off,
 * returns without touching Close -- deliberately marked synced rather than
 * retried, because "they already booked" is a final answer, not a transient
 * failure. The list self-clears after 24 hours by design and nothing here ever
 * re-logs to keep somebody in it.
 */
export async function syncWarmReplyActivity(
  event: CloseSyncEventRow,
  {
    client,
    close,
    lead,
    enabled,
  }: {
    client: WarmReplyClient;
    close: CloseClient;
    lead: LeadRow | null;
    enabled?: boolean;
  },
): Promise<{ leadId: string; contactId: string | null }> {
  const contactId = event.close_contact_id ?? lead?.close_contact_id ?? null;
  const leadId = event.close_lead_id ?? lead?.close_lead_id ?? null;
  if (!leadId) {
    // Retryable, NOT needs_review -- same reasoning as qualification
    // enrichment: the Close record is created by this lead's
    // lead_create_or_update event, which normally drained 13 minutes ago. One
    // transient Close 5xx there can invert the order, and needs_review is
    // terminal. A genuinely unresolvable event still dead-letters.
    throw new Error("Warm reply activity is missing a Close lead ID.");
  }
  const settled = { leadId, contactId };

  // Re-checked at drain time, not only at enqueue: the flag exists so the
  // setters' list can be switched off without a deploy, and that has to work on
  // events that were already queued while it was on.
  if (!(enabled ?? isWarmReplyActivityEnabled())) return settled;

  // Not "if (lead?.call_booked_at)" alone: that column only updates when the
  // Close reconciler reaches the row, and the redirect-booking cohort this
  // 15-minute delay exists for books far faster than that.
  if (lead?.call_booked_at) return settled;
  if (lead && (await hasCalendlyBooking(client, lead))) return settled;

  // Keyed on the CLOSE lead, deliberately NOT on the lead_submissions row.
  // One person routinely has several lead rows that all resolve to one Close
  // lead: /contact and /book-now mint a fresh idempotencyKey on every page
  // render, and insertQualificationLead always inserts a new row while only
  // copying close_lead_id across. A row-keyed marker cannot see the activity
  // logged for that person's other row, so a reload or a second form would put
  // a second incoming activity on one Close lead 15 minutes apart, which is the
  // exact re-warming this module exists to avoid.
  const marker = warmReplyActivityMarker(leadId);
  if (await hasExistingActivity(close, leadId, marker)) return settled;

  const email = contactEmail(event, lead);
  if (!email) {
    // Nothing to put in the required `sender` field, and inventing an address
    // would corrupt Close data. Terminal, not retryable.
    throw new CloseWarmReplyNoSenderError(
      "Warm reply activity has no captured email to use as the sender.",
    );
  }

  await close.createEmailActivity({
    lead_id: leadId,
    // Omitted rather than sent as an explicit null when there is no contact:
    // the note writer in chatbot/close-note.ts does the same, and an explicit
    // null on a Close write is the kind of thing that 400s the whole request.
    ...(contactId ? { contact_id: contactId } : {}),
    // `inbox` is what makes Close derive `direction: "incoming"`, which is the
    // only thing the smart list filters on. `direction` itself is not writable.
    // Never `outbox` or `scheduled` -- those SEND mail from the org's mailbox.
    status: "inbox",
    sender: senderHeader(displayName(event, lead), email),
    subject: subjectLine(payloadSource(event)),
    body_text: activityBody(event, lead, marker),
  });

  return settled;
}

/** Thrown when there is no captured email to use as the required sender. */
export class CloseWarmReplyNoSenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloseWarmReplyNoSenderError";
  }
}

/**
 * ponytail: check-then-act against Close's live activities, not an atomic
 * reservation, and only the newest 50 (_limit=50, unpaginated). Same trade and
 * same upgrade path as the note writer in chatbot/close-note.ts. The outbox
 * dedupe key already makes one activity per lead the normal case; this covers
 * the narrower window where Close created the activity and then the response or
 * the bookkeeping write failed, so the event retried.
 */
async function hasExistingActivity(
  close: CloseClient,
  leadId: string,
  marker: string,
): Promise<boolean> {
  const result = await close.listLeadEmailActivities(leadId);
  return (result.data ?? []).some((activity) =>
    activity.body_text?.includes(marker),
  );
}

const SOURCE_LABELS: Record<string, string> = {
  public_lead_form: "the website contact form",
  chatbot: "the website chat",
  qualification_intake: "the website qualification form",
};

/**
 * Captures that are not asking for a call, and must never be logged as a warm
 * reply.
 *
 * A newsletter signup goes through the SAME createQualificationIntakeSession as
 * the qualification funnel (services/newsletter-signup.ts passes
 * NEWSLETTER_FORM_ID). Without this, somebody who subscribed to a newsletter
 * lands in a same-day setter list under the words "asked about getting started",
 * which is both untrue and the fastest way to make Stephen distrust the list.
 */
export function isBookingIntentForm(
  formId: string | null | undefined,
): boolean {
  return formId !== NEWSLETTER_FORM_ID;
}

function subjectLine(source: string | null): string {
  if (source === "chatbot") return "Website chat: asked about getting started";
  return "Website form: asked about getting started";
}

/**
 * The activity body a rep reads in Close. Plain text on purpose: this shows up
 * in an email thread view, and it has to read like what it is rather than like
 * a system dump. No em or en dashes, no emojis.
 */
function activityBody(
  event: CloseSyncEventRow,
  lead: LeadRow | null,
  marker: string,
): string {
  const source = payloadSource(event);
  const contact = jsonObjectAt(event.payload, "contact");
  const submission = jsonObjectAt(event.payload, "submission");
  const phone = jsonStringAt(contact, "phone") ?? lead?.phone ?? null;
  const path =
    jsonStringAt(submission, "source_path") ?? lead?.source_path ?? null;
  const message = jsonStringAt(submission, "message") ?? lead?.message ?? null;

  const lines = [
    `This person contacted us through ${SOURCE_LABELS[source ?? ""] ?? "the website"} and has not booked a call.`,
    "",
    `Name: ${displayName(event, lead) ?? "not given"}`,
    `Email: ${contactEmail(event, lead) ?? "not given"}`,
    `Phone: ${phone ?? "not given"}`,
    `Page: ${path ?? "not recorded"}`,
    message ? `What they said: ${message}` : null,
    "",
    "Logged automatically by the website so this lead surfaces for same-day follow up.",
    `Website reference: ${marker}`,
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

/**
 * Close accepts `"Name" <address>` in `sender` and shows the name in the
 * activity. A name containing a quote would break the header, so quotes are
 * stripped rather than escaped.
 */
function senderHeader(name: string | null, email: string): string {
  const clean = name?.replaceAll('"', "").trim();
  return clean ? `"${clean}" <${email}>` : email;
}

function displayName(
  event: CloseSyncEventRow,
  lead: LeadRow | null,
): string | null {
  const contact = jsonObjectAt(event.payload, "contact");
  return jsonStringAt(contact, "full_name") ?? lead?.full_name ?? null;
}

function contactEmail(
  event: CloseSyncEventRow,
  lead: LeadRow | null,
): string | null {
  const contact = jsonObjectAt(event.payload, "contact");
  return jsonStringAt(contact, "email") ?? lead?.email ?? null;
}

function payloadSource(event: CloseSyncEventRow): string | null {
  const payload = event.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  return jsonStringAt(payload as Record<string, Json>, "source");
}
