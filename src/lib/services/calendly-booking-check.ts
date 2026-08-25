import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * "Has this lead already booked a call." The single copy, shared by the two
 * no-book follow-up features (close/warm-reply-activity.ts and
 * services/no-book-alert.ts). Both hinge on this answer being identical: one of
 * them puts a lead in front of a setter and the other logs an activity that
 * drops it into a same-day SLA list, and the two disagreeing would mean a lead
 * gets chased by one and not the other.
 *
 * Reads `calendly_bookings`, written by the live Calendly webhook within
 * seconds. That freshness is the whole point: the cohort these features delay
 * for is exactly the one that books through the Calendly redirect minutes after
 * the form. `lead_submissions.call_booked_at` is the slower second signal and is
 * checked by the callers, which already hold the lead row.
 */

type BookingCheckClient = Pick<SupabaseClient<Database>, "from">;

export type BookingCheckLead = {
  id: string;
  email: string | null;
};

/**
 * Throws rather than returning false when the table cannot be read. A read
 * failure means we do not know, and guessing "not booked" is the one direction
 * that burns trust: it puts a booked lead in front of a rep, or logs an activity
 * for somebody whose call is already on the calendar. Both callers hold off and
 * retry instead.
 */
export async function hasCalendlyBooking(
  client: BookingCheckClient,
  lead: BookingCheckLead,
): Promise<boolean> {
  const [linked, byEmail] = await Promise.all([
    client
      .from("calendly_bookings")
      .select("id")
      .eq("lead_submission_id", lead.id)
      .eq("status", "booked")
      .limit(1),
    lead.email
      ? client
          .from("calendly_bookings")
          .select("id")
          // ilike because the column is not stored lowercased (the index is on
          // lower(invitee_email)). The address is escaped first: an unescaped
          // `_` or `%` in a real address is a LIKE wildcard, so
          // "john_doe@x.com" would match "johnXdoe@x.com" and silently suppress
          // a genuine follow-up.
          .ilike("invitee_email", escapeLikePattern(lead.email))
          .eq("status", "booked")
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (linked.error || byEmail.error) {
    throw new Error("Could not check Calendly bookings for this lead.");
  }
  return Boolean(linked.data?.length) || Boolean(byEmail.data?.length);
}

/** Neutralises the two LIKE wildcards so an address matches only itself. */
export function escapeLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}
