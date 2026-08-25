import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config, publicConfig } from "@/lib/config";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import { jsonStringAt } from "@/lib/json-access";
import { hasCalendlyBooking } from "@/lib/services/calendly-booking-check";
import { postSlackWebhook } from "@/lib/services/leads";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

/**
 * "They filled the form 15 minutes ago and have not booked" -> one Slack message
 * so a rep can call them today.
 *
 * WHY 15 MINUTES AT THE BOTTOM. Measured over 30 days of production leads: 50 of
 * 301 eventual bookings happened within two minutes of the form, straight
 * through the Calendly redirect, and 72 within fifteen. Alerting at submit would
 * put those people in front of a rep who then finds a call already on the
 * calendar, and the alert stops being read. Everything past fifteen minutes is a
 * genuine no-book: about 76% of leads, roughly 16 a day at current volume.
 *
 * WHY 120 MINUTES AT THE TOP. Not a niceness, a safety catch. The window is
 * bounded so the very first run after deploy alerts the last two hours rather
 * than firing 300 messages for every unbooked lead in the table. It also means a
 * cron outage self-limits instead of producing a flood when it recovers.
 *
 * WHY THE DEDUPE LIVES IN `metadata`. A dedicated column would be a
 * hand-applied production migration for one timestamp. `metadata` is jsonb that
 * already exists on every lead row and is already free-form.
 */

/** Leads younger than this have not had their chance to book yet. */
const MIN_AGE_MINUTES = 15;
/** Older than this is not today's problem, and bounds the first run. */
const MAX_AGE_MINUTES = 120;
/** One run's ceiling, so a backlog drains over several runs instead of flooding. */
const MAX_PER_RUN = 25;

/** The metadata key that means "a rep has already been told about this one". */
const ALERTED_KEY = "alerted_no_book_at";

type NoBookClient = Pick<SupabaseClient<Database>, "from">;
type LeadRow = Tables<"lead_submissions">;

const LEAD_FIELDS =
  "id,full_name,email,phone,source_path,landing_path,qualification_summary,metadata,call_booked_at,lifecycle_status,latest_qualification_form_id,created_at" as const;

export type NoBookAlertResult = {
  scanned: number;
  alerted: number;
  skippedBooked: number;
  failed: number;
};

export type NoBookAlertDeps = {
  client?: NoBookClient;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  webhookUrl?: string | null;
  maxPerRun?: number;
  /** "false" switches the alert off. Anything else, including unset, is on. */
  enabled?: string;
};

/**
 * Cron body. Every per-lead failure is counted and the run continues, so one bad
 * lead cannot abandon the rest of the batch. Failing to list at all does throw,
 * on purpose: that is an infrastructure problem, and the route turning it into a
 * 500 is how anybody finds out. Nothing here can touch lead data beyond the one
 * `metadata` stamp, and nothing here runs inside a lead submit.
 */
export async function runNoBookAlertCron(
  deps: NoBookAlertDeps = {},
): Promise<NoBookAlertResult> {
  const result: NoBookAlertResult = {
    scanned: 0,
    alerted: 0,
    skippedBooked: 0,
    failed: 0,
  };

  // Default ON: Adam approved this alert going live. The flag exists purely so
  // it can be switched OFF in Vercel without a deploy if it turns out to be
  // noisy, WITHOUT unsetting SLACK_WEBHOOK_URL and taking the real lead
  // notifications down with it.
  if ((deps.enabled ?? config.NO_BOOK_ALERT_ENABLED) === "false") return result;

  const webhookUrl = deps.webhookUrl ?? config.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return result;

  const client = deps.client ?? createAdminClient();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now?.() ?? new Date();
  const nowIso = now.toISOString();

  const rows = await listUnbookedLeads(client, now, deps.maxPerRun);
  // One message per PERSON, not per lead row. Confirmed against production on
  // 2026-08-25: two rows for the same address, eight minutes apart, both inside
  // one 120-minute window. /contact and /book-now mint a fresh idempotencyKey on
  // every page render, so a reload or a second landing page gives one person
  // another row. Alerting twice for one person is exactly how a channel stops
  // being read.
  const groups = groupByEmail(rows);
  result.scanned = rows.length;

  for (const { lead, duplicates } of groups) {
    // Re-checked per lead rather than in the query: call_booked_at only updates
    // when the Close reconciler gets round to the row, and the cohort this alert
    // is about books through the Calendly redirect, which the webhook records in
    // seconds. Alerting a rep about a lead who has already booked is the one
    // outcome that would make the channel stop being read.
    let booked: boolean;
    try {
      booked = await hasCalendlyBooking(client, lead);
    } catch {
      // An unreadable bookings table means we do not know. Hold off and let the
      // next run decide rather than guessing "not booked".
      result.failed += 1;
      continue;
    }
    if (booked) {
      result.skippedBooked += 1;
      // Stamped anyway so the rows leave the window for good. Their call is
      // booked; there is nothing left to chase.
      await stampAll(client, duplicates, nowIso);
      continue;
    }

    const posted = await postSlackWebhook(
      webhookUrl,
      formatNoBookAlert(lead, now),
      fetchImpl,
    );
    if (!posted.ok) {
      // Deliberately NOT stamped. An undelivered alert must stay eligible for
      // the next run, which is the whole point of dedupeing on "was told"
      // rather than on "was looked at".
      result.failed += 1;
      console.warn("no-book alert: Slack post failed", {
        leadId: lead.id,
        error: posted.error,
      });
      continue;
    }

    // Every row for this person, so a duplicate row cannot resurface the same
    // person on the next run.
    const stamped = await stampAll(client, duplicates, nowIso);
    if (!stamped) {
      // Posted but not stamped. Counted as a failure so the run is honest about
      // it; the cost of the next run repeating this one message is far below the
      // cost of silently dropping the whole alert.
      result.failed += 1;
      continue;
    }
    result.alerted += 1;
  }

  return result;
}

/**
 * Collapses rows to one entry per email address, keeping the OLDEST row as the
 * one to report (it has the least time left to be called) and carrying every
 * row that shares the address so all of them can be stamped together.
 *
 * A row with no email is its own group: there is nothing to collapse on, and it
 * still deserves a call.
 */
function groupByEmail(
  rows: LeadRow[],
): Array<{ lead: LeadRow; duplicates: LeadRow[] }> {
  const groups = new Map<string, { lead: LeadRow; duplicates: LeadRow[] }>();
  const ungrouped: Array<{ lead: LeadRow; duplicates: LeadRow[] }> = [];

  for (const row of rows) {
    const key = row.email?.trim().toLowerCase();
    if (!key) {
      ungrouped.push({ lead: row, duplicates: [row] });
      continue;
    }
    const existing = groups.get(key);
    // Rows arrive oldest-first, so the first one seen is the one to report.
    if (existing) existing.duplicates.push(row);
    else groups.set(key, { lead: row, duplicates: [row] });
  }

  return [...groups.values(), ...ungrouped];
}

/** Stamps every row for one person. False if any write failed. */
async function stampAll(
  client: NoBookClient,
  leads: LeadRow[],
  nowIso: string,
): Promise<boolean> {
  const results = await Promise.all(
    leads.map((lead) => stampAlerted(client, lead, nowIso)),
  );
  return results.every(Boolean);
}

/**
 * Leads captured between 15 and 120 minutes ago that Close has not recorded a
 * booking for and that nobody has been told about.
 */
async function listUnbookedLeads(
  client: NoBookClient,
  now: Date,
  maxPerRun = MAX_PER_RUN,
): Promise<LeadRow[]> {
  const newest = new Date(now.getTime() - MIN_AGE_MINUTES * 60_000);
  const oldest = new Date(now.getTime() - MAX_AGE_MINUTES * 60_000);

  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .is("call_booked_at", null)
    .is(`metadata->>${ALERTED_KEY}`, null)
    // Newsletter subscribers are not waiting for a call. They reach
    // lead_submissions through the SAME createQualificationIntakeSession as the
    // qualification funnel (newsletter-signup.ts passes NEWSLETTER_FORM_ID), so
    // without these two filters somebody who signed up for a newsletter gets
    // posted to the team as "No call booked" twenty minutes later.
    //
    // Two filters because the two states are recorded in different places:
    // lifecycle_status only becomes "newsletter_subscribed" once the signup
    // completes, so a subscriber still mid-session is caught by the form id
    // instead. The or() keeps rows whose form id is NULL, which is every plain
    // contact-form lead: a bare .neq() would drop all of them, because in SQL
    // NULL != x is not true.
    .neq("lifecycle_status", "newsletter_subscribed")
    .or(
      `latest_qualification_form_id.is.null,latest_qualification_form_id.neq.${NEWSLETTER_FORM_ID}`,
    )
    .gte("created_at", oldest.toISOString())
    .lte("created_at", newest.toISOString())
    // Oldest first: the lead closest to falling out of the 120-minute window is
    // the one with the least time left to be called.
    .order("created_at", { ascending: true })
    .limit(maxPerRun);

  if (error) throw new Error("Could not list unbooked leads.");
  return (data ?? []) as LeadRow[];
}

/**
 * Merges the alerted stamp into the existing metadata object.
 *
 * ponytail: read-modify-write, not an atomic jsonb_set. Two concurrent runs
 * could each read the same metadata and one could drop a key the other had just
 * added. Acceptable: this cron is the only writer of this key, Vercel does not
 * overlap a cron with itself, and the worst case is one repeated Slack message.
 * Upgrade path if another writer ever appears: an `update ... set metadata =
 * metadata || jsonb_build_object(...)` RPC.
 */
async function stampAlerted(
  client: NoBookClient,
  lead: LeadRow,
  nowIso: string,
): Promise<boolean> {
  const existing =
    lead.metadata &&
    typeof lead.metadata === "object" &&
    !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, Json>)
      : {};

  const { error } = await client
    .from("lead_submissions")
    .update({ metadata: { ...existing, [ALERTED_KEY]: nowIso } as Json })
    .eq("id", lead.id);

  if (error) {
    console.warn("no-book alert: could not stamp lead", { leadId: lead.id });
    return false;
  }
  return true;
}

/**
 * The message a rep reads on their phone. Phone number first and tappable,
 * because the only action this alert wants is a call. Slack renders `tel:` in
 * angle-bracket link syntax as a tappable link on mobile.
 *
 * No em or en dashes, no emojis.
 */
export function formatNoBookAlert(
  lead: LeadRow,
  now: Date = new Date(),
): string {
  const name = lead.full_name?.trim() || "Website lead";
  const page = lead.source_path || lead.landing_path || "not recorded";

  const lines = [
    `*No call booked: ${name}*`,
    lead.phone
      ? `Phone: <tel:${telHref(lead.phone)}|${lead.phone}>`
      : "Phone: not given",
    `Email: ${lead.email || "not given"}`,
    `Page: ${page}`,
    `Band: ${bandLabel(lead)}`,
    `Submitted ${minutesAgo(lead, now)} minutes ago and has not booked.`,
    `${publicConfig.siteUrl}/admin/leads?call=not_booked`,
  ];

  return lines.join("\n");
}

/** Slack's tel: link only survives digits and a leading plus. */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `+${digits.replace(/\+/g, "")}` : digits;
}

/**
 * The qualification band, when there is one. A lead alerted 15 minutes after the
 * contact form usually has not finished qualifying yet, so "not scored yet" is
 * the honest and common answer rather than an error.
 */
function bandLabel(lead: LeadRow): string {
  const summary = lead.qualification_summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return "not scored yet";
  }
  return (
    jsonStringAt(summary as Record<string, Json>, "qualification_band") ??
    "not scored yet"
  );
}

function minutesAgo(lead: LeadRow, now: Date): number {
  const created = Date.parse(lead.created_at);
  if (Number.isNaN(created)) return MIN_AGE_MINUTES;
  return Math.max(0, Math.round((now.getTime() - created) / 60_000));
}
