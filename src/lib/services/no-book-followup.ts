import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendResend } from "@/lib/chatbot/emails";
import { config, publicConfig } from "@/lib/config";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import {
  escapeLikePattern,
  hasCalendlyBooking,
} from "@/lib/services/calendly-booking-check";
import {
  bookingLink,
  buildFollowupEmail,
  type FollowupStep,
  skipReason,
  STEP_WINDOWS,
  STEPS,
  stepKey,
  unsubscribeUrl,
} from "@/lib/services/no-book-followup-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

/**
 * Cron body for the lead-facing no-book follow-up (copy and rules live in
 * no-book-followup-plan.ts). Runs beside the Slack no-book alert: the alert
 * tells a setter, this emails the lead a one-tap booking link. Neither waits
 * on the other.
 *
 * Fails closed: nothing sends unless SELF_BOOK_FOLLOWUP_ENABLED is exactly
 * "true" AND Resend, CRON_SECRET (unsubscribe links) and a mailing address are
 * all configured.
 */

type Client = Pick<SupabaseClient<Database>, "from">;
type LeadRow = Tables<"lead_submissions">;

const MAX_PER_RUN = 25;

const LEAD_FIELDS =
  "id,full_name,email,source_path,qualification_summary,metadata,call_booked_at,lifecycle_status,latest_qualification_form_id,utm_source,utm_medium,utm_campaign,created_at" as const;

export type FollowupRunResult = {
  enabled: boolean;
  scanned: number;
  sent: Record<FollowupStep, number>;
  skipped: Record<string, number>;
  failed: number;
};

export type FollowupDeps = {
  client?: Client;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  enabled?: string;
  mailingAddress?: string;
  secret?: string;
  hasResend?: boolean;
  maxPerRun?: number;
};

export async function runNoBookFollowupCron(
  deps: FollowupDeps = {},
): Promise<FollowupRunResult> {
  const result: FollowupRunResult = {
    enabled: false,
    scanned: 0,
    sent: { 1: 0, 2: 0, 3: 0 },
    skipped: {},
    failed: 0,
  };

  const enabled =
    (deps.enabled ?? config.SELF_BOOK_FOLLOWUP_ENABLED) === "true";
  const mailingAddress = deps.mailingAddress ?? config.COMPANY_MAILING_ADDRESS;
  const secret = deps.secret ?? config.CRON_SECRET;
  const hasResend = deps.hasResend ?? Boolean(config.RESEND_API_KEY);
  if (!enabled || !mailingAddress || !secret || !hasResend) return result;
  result.enabled = true;

  const client = deps.client ?? createAdminClient();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now?.() ?? new Date();
  let budget = deps.maxPerRun ?? MAX_PER_RUN;

  for (const step of STEPS) {
    if (budget <= 0) break;
    const rows = await listCandidates(client, step, now, budget);
    result.scanned += rows.length;
    const seen = new Set<string>();

    for (const lead of rows) {
      const email = lead.email.trim().toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);

      let history: LeadRow[];
      let booked: boolean;
      try {
        history = await listHistory(client, email);
        booked = await hasCalendlyBooking(client, lead);
      } catch (error) {
        // Unknown booking or unsubscribe state: wait for the next run rather
        // than risk mailing someone who booked or opted out.
        result.failed += 1;
        console.warn("no-book followup: could not read lead history", {
          leadId: lead.id,
          name: error instanceof Error ? error.name : "UnknownError",
        });
        continue;
      }

      const reason = booked ? "booked" : skipReason(lead, history, step);
      if (reason) {
        result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
        // Stamp so the row leaves this step's candidate list; the stamp value
        // records why nothing was sent.
        if (reason !== "previous_step_missing") {
          await stamp(client, lead, step, `skipped:${reason}`);
        }
        continue;
      }

      budget -= 1;
      const unsubscribe = unsubscribeUrl(publicConfig.siteUrl, email, secret);
      const message = buildFollowupEmail(lead, step, {
        booking: bookingLink(lead, step),
        unsubscribe,
        mailingAddress,
      });
      const sent = await sendResend(
        {
          ...message,
          to: [lead.email.trim()],
          fromName: "Vendingpreneurs",
          headers: {
            "List-Unsubscribe": `<${unsubscribe}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        },
        fetchImpl,
      );
      if (!sent.ok) {
        // Not stamped: an undelivered email stays eligible while its window is open.
        result.failed += 1;
        console.warn("no-book followup: send failed", {
          leadId: lead.id,
          step,
          error: sent.error,
        });
        continue;
      }
      if (!(await stamp(client, lead, step, now.toISOString()))) {
        result.failed += 1;
        continue;
      }
      result.sent[step] += 1;
      if (budget <= 0) break;
    }
  }

  return result;
}

/** Rows inside this step's window that have not been handled for this step. */
async function listCandidates(
  client: Client,
  step: FollowupStep,
  now: Date,
  limit: number,
): Promise<LeadRow[]> {
  const [opens, closes] = STEP_WINDOWS[step];
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_FIELDS)
    .is("call_booked_at", null)
    .is(`metadata->>${stepKey(step)}`, null)
    .not("email", "is", null)
    // Same newsletter exclusion as the Slack no-book alert (see its comment).
    .neq("lifecycle_status", "newsletter_subscribed")
    .or(
      `latest_qualification_form_id.is.null,latest_qualification_form_id.neq.${NEWSLETTER_FORM_ID}`,
    )
    .gte("created_at", new Date(now.getTime() - closes).toISOString())
    .lte("created_at", new Date(now.getTime() - opens).toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("Could not list no-book follow-up candidates.");
  return (data ?? []) as LeadRow[];
}

/** Every row for one address: stamps, bookings and opt-outs live on any of them. */
async function listHistory(client: Client, email: string): Promise<LeadRow[]> {
  const { data, error } = await client
    .from("lead_submissions")
    .select("id,metadata,call_booked_at,qualification_summary")
    .ilike("email", escapeLikePattern(email))
    .limit(50);
  if (error) throw new Error("Could not read lead history.");
  return (data ?? []) as LeadRow[];
}

// ponytail: read-modify-write on metadata, same trade-off as no-book-alert's
// stampAlerted. This cron is the only writer of the nbf_* keys and Vercel does
// not overlap a cron with itself; worst case is one repeated email.
async function stamp(
  client: Client,
  lead: LeadRow,
  step: FollowupStep,
  value: string,
): Promise<boolean> {
  const existing =
    lead.metadata &&
    typeof lead.metadata === "object" &&
    !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, Json>)
      : {};
  const { error } = await client
    .from("lead_submissions")
    .update({ metadata: { ...existing, [stepKey(step)]: value } as Json })
    .eq("id", lead.id);
  if (error) {
    console.warn("no-book followup: could not stamp lead", {
      leadId: lead.id,
      step,
    });
    return false;
  }
  return true;
}
