import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAttributionSession } from "@/lib/attribution-session";
import { submitLead } from "@/lib/services/leads";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * §Lead wiring (spec .claude/specs/2026-08-20-site-chatbot.md). Read before
 * touching: src/lib/services/leads.ts (submitLead) and src/lib/close/sync.ts
 * (taggingValues / isChatbotSourcedLead) — this file is the seam between the
 * chatbot and both.
 *
 * Decisions made here, and why:
 *
 * - form_type is "contact", not a new "chatbot" value. The DB CHECK on
 *   lead_submissions.form_type only allows ('apply', 'contact') — "apply"
 *   also requires state/business-stage/budget/timeline the chatbot rarely
 *   has. Adding a third DB-level value is a migration touching a Tier-1
 *   shared table for a cosmetic label; "contact" is the safest existing
 *   semantics the spec asks for when a dedicated type isn't safe to add.
 * - Close tagging (entry_source unset, resource_tag "chatbot") is driven by
 *   `metadata.source === "chatbot"`, read in close/sync.ts's
 *   isChatbotSourcedLead(). metadata is free-form JSON submitLead already
 *   threads through untouched — no schema change, no FK risk (unlike
 *   latest_qualification_form_id, which is a real FK to qualification_forms
 *   and cannot hold a sentinel value).
 * - The plain Resend/Slack lead notification is suppressed via
 *   `skipNotification` (leads.ts) — Phase 4 sends a richer profile email
 *   instead and must not double-email the team. Money Page tracking and
 *   Close sync are untouched.
 * - Only fires when an email has been captured. submitLead() requires a
 *   valid email (a hard `z.email()` field) — a phone-only capture has no
 *   honest value to put there, and inventing one would corrupt Close data.
 *   ponytail: phone-only leads currently never reach Close from the chatbot.
 *   Upgrade path: give submitLead an email-optional path if that gap starts
 *   costing the team real leads.
 */
export const CHATBOT_LEAD_SOURCE = "chatbot";

type ConversationClient = Pick<SupabaseClient<Database>, "from">;

export type ChatbotLeadCaptureInput = {
  conversationId: string;
  sessionId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  pageUrl: string | null;
  /** The browser's stored attribution session (`vp_attr`), unvalidated. */
  attribution?: unknown;
};

/**
 * submitLead field, attribution-session key, and the length submitLead's
 * schema allows (lead-source-fields.ts). A longer value is cut, not rejected:
 * an over-long UTM must never cost the lead.
 */
const ATTRIBUTION_FIELDS = [
  ["vpSessionId", "vp_session_id", 160],
  ["firstLandingUrl", "first_landing_url", 1200],
  ["firstLandingPath", "first_landing_path", 500],
  ["firstReferrer", "first_referrer", 1000],
  ["firstTouchAt", "first_touch_at", 80],
  ["latestLandingUrl", "latest_landing_url", 1200],
  ["latestLandingPath", "latest_landing_path", 500],
  ["latestReferrer", "latest_referrer", 1000],
  ["latestTouchAt", "latest_touch_at", 80],
  ["utmSource", "utm_source", 160],
  ["utmMedium", "utm_medium", 160],
  ["utmCampaign", "utm_campaign", 200],
  ["utmTerm", "utm_term", 200],
  ["utmContent", "utm_content", 200],
  ["gclid", "gclid", 300],
  ["fbclid", "fbclid", 500],
  ["gbraid", "gbraid", 300],
  ["wbraid", "wbraid", 300],
  ["campaignId", "campaign_id", 200],
  ["campaignName", "campaign_name", 300],
  ["adsetId", "adset_id", 200],
  ["adGroupId", "ad_group_id", 200],
  ["adId", "ad_id", 200],
] as const;

/**
 * The visitor's UTMs, click ids and first/latest touch, as submitLead fields.
 *
 * Until 2026-11-24 a chatbot lead carried none of this: the widget sent only
 * its own chat session id, so every chatbot lead reached Close with blank UTMs
 * (19 of 19 in November) and read as Unknown in the journey report, even when
 * the visitor arrived on a tagged link.
 */
export function chatbotAttributionFields(
  raw: unknown,
): Partial<
  Record<(typeof ATTRIBUTION_FIELDS)[number][0] | "referrer", string>
> {
  let session;
  try {
    session = parseAttributionSession(
      typeof raw === "string" ? raw : JSON.stringify(raw ?? null),
    );
  } catch {
    return {};
  }
  if (!session) return {};

  const fields: Record<string, string> = {};
  for (const [field, key, max] of ATTRIBUTION_FIELDS) {
    const value = session[key]?.trim().slice(0, max);
    if (value) fields[field] = value;
  }
  const referrer = fields.latestReferrer || fields.firstReferrer;
  if (referrer) fields.referrer = referrer;
  return fields;
}

/**
 * Called on a NEW capture (the turn where an email/phone first appears in a
 * conversation that had none). Reuses the existing lead pipeline end to end:
 * lead_submissions row -> Money Page ingest -> Close sync queue. Never
 * throws — a capture failure must not break the chat turn that triggered it.
 * Returns the lead_submission_id on success so the caller can store it back
 * on the conversation row, or null if nothing was submitted.
 */
export async function handleChatbotLeadCaptured(
  input: ChatbotLeadCaptureInput,
  deps: { client?: ConversationClient } = {},
): Promise<string | null> {
  if (!input.email) return null;

  const client = deps.client ?? createAdminClient();

  try {
    const result = await submitLead(
      {
        formType: "contact",
        // Stable per conversation: a re-trigger (e.g. two turns landing a
        // capture before the first write completes) resolves through
        // submitLead's existing idempotency lookup instead of duplicating.
        idempotencyKey: `chatbot:${input.conversationId}`,
        fullName: input.name || "Website chat visitor",
        email: input.email,
        phone: input.phone,
        sourcePath: input.pageUrl,
        landingPath: input.pageUrl,
        // The chat session id is the fallback only: the attribution session
        // id below is the one page views and bookings are keyed on.
        vpSessionId: input.sessionId,
        ...chatbotAttributionFields(input.attribution),
        message: "Captured by the site chatbot.",
        metadata: {
          source: CHATBOT_LEAD_SOURCE,
          conversation_id: input.conversationId,
        },
      },
      { client, skipNotification: true },
    );

    const { error } = await client
      .from("chatbot_conversations")
      .update({ lead_submission_id: result.leadId, status: "lead_captured" })
      .eq("id", input.conversationId);
    if (error) {
      console.warn("chatbot: could not link lead_submission_id", {
        conversationId: input.conversationId,
        error: error.message,
      });
    }

    return result.leadId;
  } catch (error) {
    console.warn("chatbot: lead capture failed", {
      conversationId: input.conversationId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}
