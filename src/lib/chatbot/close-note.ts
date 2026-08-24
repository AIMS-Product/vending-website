import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * The one place the chatbot writes a note onto a Close lead.
 *
 * Extracted from close-booking-note.ts when engagement enrichment became a
 * second writer. Both callers need the identical guarantees -- resolve the
 * lead, do not double-post, never throw -- and having that logic in two
 * places is how one copy quietly drifts out of sync with the other.
 *
 * Notes only, on purpose. `entry_source` is a strict `choices` field in Close
 * that fails the whole lead update on an unexpected value, and Recapture
 * State / Ever Had Call are owned by Close's own automation (see the comments
 * around `closeTaggingPayload` in close/client.ts) -- writing any of those
 * from here could park a lead or steal it from that automation. A note is
 * additive: it cannot fail a lead update, cannot overwrite anything a rep
 * edited, and cannot change which leads a Close workflow picks up.
 */

export type NoteClient = Pick<SupabaseClient<Database>, "from">;

export type WriteLeadNoteOnceInput = {
  /** Used to resolve the Close lead, unless `closeLeadId` is supplied. */
  conversationId: string;
  /** Short-circuits the Supabase lookup when the caller already knows it. */
  closeLeadId?: string | null;
  /** Stable string embedded in the note body; a note carrying it is never re-posted. */
  marker: string;
  /** Receives the marker so it can embed it. Returns the full note HTML. */
  buildHtml: (marker: string) => string;
};

export type WriteLeadNoteOnceResult =
  | "written"
  | "duplicate"
  | "no-lead"
  | "not-configured"
  | "failed";

/**
 * Posts a note exactly once per marker. Fails soft end to end -- no
 * configured API key, a missing Close lead, a Close 4xx, a network error --
 * none of it throws. Callers sit inside a webhook handler and a sync drain;
 * either one throwing over a bookkeeping note would make Calendly retry a
 * booking that is already recorded, or fail a lead sync that already
 * succeeded.
 */
export async function writeLeadNoteOnce(
  input: WriteLeadNoteOnceInput,
  deps: { client?: NoteClient; closeClient?: CloseClient } = {},
): Promise<WriteLeadNoteOnceResult> {
  if (!config.CLOSE_API_KEY) return "not-configured";

  try {
    const leadId =
      input.closeLeadId ??
      (await resolveCloseLeadId(
        deps.client ?? createAdminClient(),
        input.conversationId,
      ));
    if (!leadId) return "no-lead"; // No CRM record yet -- normal, not an error.

    const closeClient =
      deps.closeClient ??
      createCloseClient({
        apiKey: config.CLOSE_API_KEY,
        baseUrl: config.CLOSE_API_BASE_URL,
      });

    // ponytail: check-then-act against Close's live notes, not an atomic
    // reservation. Close's note-create endpoint has no idempotency key or
    // server-side dedupe (checked against developer.close.com), and these
    // callers do not go through the close_sync_events outbox that gives lead
    // writes their dedupe guarantee (dedupe.ts) -- so there is no queue row to
    // make this atomic. Two deliveries landing at the same instant could both
    // pass this check and post twice; a redelivery minutes apart or a
    // scheduled sweep will not. Upgrade path if that race ever matters: a
    // unique constraint on a small "close_chatbot_notes" table keyed by the
    // same marker.
    // ponytail: the marker is looked for in the newest page of notes only
    // (client.ts sends _limit=50, unpaginated). A lead that accumulates 50
    // newer notes could take a second copy. Acceptable: these notes are
    // written within minutes of the event, and the sweeps are idempotent on
    // the same day. Same upgrade path.
    if (await hasExistingNote(closeClient, leadId, input.marker)) {
      return "duplicate";
    }

    await closeClient.createNote({
      lead_id: leadId,
      note_html: input.buildHtml(input.marker),
    });
    return "written";
  } catch (error) {
    console.warn("chatbot: could not write Close lead note", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

/** conversation -> lead_submission -> close_lead_id. Null at any missing hop. */
export async function resolveCloseLeadId(
  client: NoteClient,
  conversationId: string,
): Promise<string | null> {
  const conversation = await client
    .from("chatbot_conversations")
    .select("lead_submission_id")
    .eq("id", conversationId)
    .maybeSingle();

  const leadSubmissionId = conversation.data?.lead_submission_id;
  if (conversation.error || !leadSubmissionId) return null;

  const lead = await client
    .from("lead_submissions")
    .select("close_lead_id")
    .eq("id", leadSubmissionId)
    .maybeSingle();

  if (lead.error || !lead.data?.close_lead_id) return null;
  return lead.data.close_lead_id;
}

async function hasExistingNote(
  closeClient: CloseClient,
  leadId: string,
  marker: string,
): Promise<boolean> {
  const result = await closeClient.listLeadNotes(leadId);
  return (result.data ?? []).some(
    (note) => note.note_html?.includes(marker) || note.note?.includes(marker),
  );
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
