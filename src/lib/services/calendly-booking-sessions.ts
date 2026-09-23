import "server-only";

import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Which browser made each booking.
 *
 * Written when a visitor books in an on-site Calendly embed: the embed hands
 * the page the invitee URI, and the page sends it with its own session id.
 * Read wherever a booking needs its session — the pre-call video reports —
 * because a lead row only exists for people who filled a site form, and
 * webinar attendees book on /start without ever doing that.
 *
 * See the calendly_booking_sessions migration for why first write wins.
 */

/** Calendly's API resource for one invitee, and nothing else. */
const INVITEE_URI =
  /^https:\/\/api\.calendly\.com\/scheduled_events\/[A-Za-z0-9-]{1,64}\/invitees\/[A-Za-z0-9-]{1,64}$/;

export function isCalendlyInviteeUri(value: string): boolean {
  return INVITEE_URI.test(value);
}

/**
 * Records the pair. Best-effort by contract, like the other attribution
 * writers: never throws, and a missing table (before the migration is
 * applied) is a no-op rather than a failed request.
 */
export async function recordBookingSession({
  vpSessionId,
  inviteeUri,
}: {
  vpSessionId: string;
  inviteeUri: string;
}): Promise<void> {
  const session = vpSessionId.trim();
  const uri = inviteeUri.trim();
  if (!session || session.length > 160 || !isCalendlyInviteeUri(uri)) return;

  try {
    await createAdminClient()
      .from("calendly_booking_sessions")
      .upsert(
        { invitee_uri: uri, vp_session_id: session },
        { onConflict: "invitee_uri", ignoreDuplicates: true },
      );
  } catch {
    // Reporting, not the product. A failure here must never reach a visitor.
  }
}

export type BookingLinks = {
  sessionByInvitee: Map<string, string>;
  /** Every invitee a session ever booked, for the shared-browser check. */
  inviteesBySession: Map<string, string[]>;
};

export const NO_BOOKING_LINKS: BookingLinks = {
  sessionByInvitee: new Map(),
  inviteesBySession: new Map(),
};

/**
 * The whole link table, both ways round.
 *
 * Whole-table because the shared-browser check in resolveBookingSessions needs
 * every booking a session ever made, not only the ones in the report window.
 * ponytail: whole-table read, ~50 rows a day; move the check into SQL if it
 * ever passes ~50k rows.
 *
 * Null when the table exists but cannot be read, so the page can say the
 * links are missing instead of quietly showing linked people as "No session".
 * A table that does not exist yet (migration not applied) is simply empty.
 */
export async function loadBookingLinks(): Promise<BookingLinks | null> {
  try {
    const { rows, error } = await readAllPages<{
      invitee_uri: string;
      vp_session_id: string;
    }>((from, to, count) =>
      createAdminClient()
        .from("calendly_booking_sessions")
        .select("invitee_uri,vp_session_id", { count })
        .order("invitee_uri")
        .range(from, to),
    );
    if (error) return error.code === "PGRST205" ? NO_BOOKING_LINKS : null;

    const sessionByInvitee = new Map<string, string>();
    const inviteesBySession = new Map<string, string[]>();
    for (const row of rows) {
      sessionByInvitee.set(row.invitee_uri, row.vp_session_id);
      inviteesBySession.set(row.vp_session_id, [
        ...(inviteesBySession.get(row.vp_session_id) ?? []),
        row.invitee_uri,
      ]);
    }
    return { sessionByInvitee, inviteesBySession };
  } catch {
    return null;
  }
}
