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

/**
 * Session id by invitee URI, for the URIs asked about.
 *
 * Reads the whole table rather than an `in` list: invitee URIs are ~100
 * characters, so a 90-day window's worth would need dozens of batched
 * requests, while the table itself only grows by the site's own bookings.
 * ponytail: whole-table read, ~50 rows a day; switch to batched `in` lists if
 * it ever passes ~50k rows.
 *
 * An unreadable table returns an empty map: every booking then falls back to
 * its lead row, which is exactly how the reports behaved before this existed.
 */
export async function loadSessionsByInvitee(
  inviteeUris: string[],
): Promise<Map<string, string>> {
  const wanted = new Set(inviteeUris.filter(Boolean));
  if (wanted.size === 0) return new Map();

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
    // A partial read would silently drop some links and move people from
    // "watched" to "no session" without saying so. All or nothing.
    if (error) return new Map();
    return new Map(
      rows
        .filter((row) => wanted.has(row.invitee_uri))
        .map((row) => [row.invitee_uri, row.vp_session_id]),
    );
  } catch {
    return new Map();
  }
}
