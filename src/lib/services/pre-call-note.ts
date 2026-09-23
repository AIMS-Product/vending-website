import "server-only";

import { createCloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { buildCallCreditReport } from "@/lib/services/call-credit-data";
import {
  buildPreCallBriefing,
  type BriefingRow,
} from "@/lib/services/pre-call-briefing";
import {
  loadEngagementBySession,
  loadLeadFacts,
  resolveBookingSessions,
} from "@/lib/services/pre-call-engagement";
import {
  loadBookingLinks,
  NO_BOOKING_LINKS,
} from "@/lib/services/calendly-booking-sessions";

/**
 * Puts what a prospect watched on their Close lead, shortly before the call.
 *
 * Reps live in Close, not in /admin. The admin table is the whole picture; this
 * is the one line they actually see, on the record they already have open when
 * the call starts.
 *
 * Timed close to the call rather than the night before, because the point is
 * what they watched, and most of the watching happens in the hours after the
 * booking email lands. Close has no note-update endpoint, so a note posted
 * early could only ever be corrected by posting a second one.
 *
 * A note rather than a custom field on purpose: a field needs someone with
 * Close admin to create it and a field id in the environment before anything
 * works, and this needed neither. If reps start filtering smart lists on
 * engagement, that is the moment to ask for a field.
 */

/**
 * Marks our own notes so a re-run does not post a second one. Close's
 * note-create endpoint has no idempotency key, so the marker plus a list-first
 * check is the mechanism (see client.listLeadNotes).
 */
export const PRE_CALL_NOTE_MARKER = "[Pre-call resources]";

export type PreCallNoteResult = {
  considered: number;
  posted: number;
  skipped: number;
  /** Upcoming calls with no Close lead to write to. */
  unwritable: number;
  /** Upcoming calls with no browser tied to them, so nothing honest to say. */
  untracked: number;
};

/**
 * The note body.
 *
 * Written as a sentence a rep can read in the two seconds before they dial,
 * not a data dump: the count, then the two videos they got furthest through,
 * because those name the objection the call should open on.
 */
export function buildPreCallNoteHtml(row: BriefingRow): string {
  const { watchedCount, totalVideos, finishedCount, videos } = row.engagement;

  if (watchedCount === 0) {
    return (
      `<p>${PRE_CALL_NOTE_MARKER} Nothing opened on the pre-call resources ` +
      `page before this call.</p>`
    );
  }

  const top = videos
    .slice(0, 3)
    .map((video) => `<li>${escapeHtml(video.label)} — ${video.percent}%</li>`)
    .join("");

  return (
    `<p>${PRE_CALL_NOTE_MARKER} Watched ${watchedCount} of ${totalVideos} ` +
    `videos before this call, ${finishedCount} most of the way through. ` +
    `Furthest through:</p><ul>${top}</ul>`
  );
}

/**
 * Posts the note for every call starting inside the window.
 *
 * Best-effort per lead: one lead whose Close write fails must not stop the
 * others, because the run is hourly and a lost note cannot be retried after
 * the call it was for.
 */
export async function sweepPreCallNotes({
  hoursAhead = 3,
  now = new Date(),
  dryRun = false,
}: {
  hoursAhead?: number;
  now?: Date;
  dryRun?: boolean;
} = {}): Promise<PreCallNoteResult> {
  const result: PreCallNoteResult = {
    considered: 0,
    posted: 0,
    skipped: 0,
    unwritable: 0,
    untracked: 0,
  };

  // A call happening in the next few hours was booked at most a couple of
  // months ago in every realistic case; 90 days of booking history is the
  // window that holds them all without reading the whole table.
  const report = await buildCallCreditReport({ days: 90 });
  const [leadFacts, links] = await Promise.all([
    loadLeadFacts(
      report.rows.flatMap((row) =>
        row.leadSubmissionId ? [row.leadSubmissionId] : [],
      ),
    ),
    loadBookingLinks(),
  ]);
  const sessionsByBooking = resolveBookingSessions(
    report.rows,
    leadFacts,
    links ?? NO_BOOKING_LINKS,
  );

  const engagementBySession = await loadEngagementBySession(
    [...sessionsByBooking.values()].flat(),
  );
  // A note posts once and cannot be edited later (Close has no note update),
  // so a run that cannot read every view row posts nothing rather than tell a
  // rep that a prospect "opened nothing". The next hourly run tries again.
  if (!engagementBySession) return result;

  const briefing = buildPreCallBriefing({
    rows: report.rows,
    sessionsByBooking,
    engagementBySession,
    now,
    // Fractional days: the window is "about to happen", not "this fortnight".
    horizonDays: hoursAhead / 24,
  });

  result.considered = briefing.length;
  if (briefing.length === 0 || !config.CLOSE_API_KEY) return result;

  const close = createCloseClient({ apiKey: config.CLOSE_API_KEY });

  for (const row of briefing) {
    // No browser tied to this booking means we could not watch, not that they
    // watched nothing. A note saying "Nothing opened" would be a claim we
    // cannot back, and it can never be corrected once posted.
    if (row.unknownSession) {
      result.untracked += 1;
      continue;
    }
    const closeLeadId = closeLeadIdFor(row, report.rows, leadFacts);
    if (!closeLeadId) {
      result.unwritable += 1;
      continue;
    }

    try {
      const existing = await close.listLeadNotes(closeLeadId);
      const alreadyNoted = (existing.data ?? []).some((note) =>
        `${note.note ?? ""}${note.note_html ?? ""}`.includes(
          PRE_CALL_NOTE_MARKER,
        ),
      );
      if (alreadyNoted) {
        result.skipped += 1;
        continue;
      }

      if (dryRun) {
        result.posted += 1;
        continue;
      }

      await close.createNote({
        lead_id: closeLeadId,
        note_html: buildPreCallNoteHtml(row),
      });
      result.posted += 1;
    } catch (error) {
      // One lead's failure is not the sweep's failure.
      console.warn("pre-call note failed", {
        closeLeadId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return result;
}

function closeLeadIdFor(
  row: BriefingRow,
  rows: { id: string; leadSubmissionId: string | null }[],
  leadFacts: Map<string, { closeLeadId: string | null }>,
): string | null {
  const leadId = rows.find(
    (candidate) => candidate.id === row.id,
  )?.leadSubmissionId;
  return leadId ? (leadFacts.get(leadId)?.closeLeadId ?? null) : null;
}

/** Close renders note_html, so a member's name has to be inert. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
