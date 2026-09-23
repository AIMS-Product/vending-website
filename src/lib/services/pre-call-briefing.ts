import type { CallCreditRow } from "@/lib/services/call-credit";
import {
  mergeEngagement,
  type PreCallEngagement,
} from "@/lib/services/pre-call-engagement";

/**
 * The calls a rep has coming up, each with what that person watched.
 *
 * The point of the page is the second column. Everyone booked is a warm lead
 * on paper; the ones who sat through the pricing video and the financing video
 * are a different conversation from the ones who never opened the page, and
 * until now nothing anywhere told a rep which was which.
 */

export type BriefingRow = {
  id: string;
  name: string;
  email: string | null;
  calendar: string | null;
  startAt: string;
  setBy: string;
  engagement: PreCallEngagement;
  /**
   * True when we have no session id for this booking at all — a call booked
   * outside our forms, or a lead captured before the session id existed.
   * Distinct from "watched nothing", which is a real and actionable zero.
   */
  unknownSession: boolean;
};

/**
 * Upcoming, non-canceled calls, soonest first.
 *
 * Canceled calls are dropped rather than shown struck through: this is a list
 * to work from before a call, and a canceled call is not one.
 */
export function buildPreCallBriefing({
  rows,
  sessionByLead = new Map(),
  sessionsByBooking,
  engagementBySession,
  now = new Date(),
  horizonDays = 14,
}: {
  rows: CallCreditRow[];
  sessionByLead?: Map<string, string>;
  /**
   * Sessions per booking id, from resolveBookingSessions. When given it is the
   * answer: it already includes every lead-row session and adds bookings
   * linked in the on-site calendar. Engagement is merged across them.
   */
  sessionsByBooking?: Map<string, string[]>;
  /**
   * Null when the views could not be read in full: every booking then reads
   * as "no session" (cannot tell), never as "watched nothing".
   */
  engagementBySession: Map<string, PreCallEngagement> | null;
  now?: Date;
  horizonDays?: number;
}): BriefingRow[] {
  const from = now.getTime();
  const until = from + horizonDays * 86_400_000;

  return rows
    .filter((row) => {
      if (row.canceled || !row.startAt) return false;
      const startsAt = Date.parse(row.startAt);
      return Number.isFinite(startsAt) && startsAt >= from && startsAt <= until;
    })
    .map((row) => {
      const leadSession = row.leadSubmissionId
        ? sessionByLead.get(row.leadSubmissionId)
        : undefined;
      const sessions = engagementBySession
        ? sessionsByBooking
          ? (sessionsByBooking.get(row.id) ?? [])
          : leadSession
            ? [leadSession]
            : []
        : [];
      return {
        id: row.id,
        name: row.inviteeName?.trim() || row.inviteeEmail || "Unknown",
        email: row.inviteeEmail,
        calendar: row.calendar,
        startAt: row.startAt as string,
        setBy: row.credit.who,
        engagement: mergeEngagement(
          sessions.flatMap((session) => {
            const found = engagementBySession?.get(session);
            return found ? [found] : [];
          }),
        ),
        unknownSession: sessions.length === 0,
      };
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

/**
 * The people worth a nudge: a call is coming and they have watched nothing.
 *
 * Bookings we cannot match to a session are excluded. Chasing someone who
 * watched everything on a device we could not see is the one outcome that
 * would make a rep stop trusting the column.
 */
export function coldBookings(briefing: BriefingRow[]): BriefingRow[] {
  return briefing.filter(
    (row) => !row.unknownSession && row.engagement.watchedCount === 0,
  );
}
