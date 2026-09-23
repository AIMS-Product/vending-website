import "server-only";

import { chunk, ID_BATCH } from "@/lib/batch";
import {
  classifyBookedCall,
  type FunnelShowRow,
} from "@/lib/services/funnel-monthly";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Did the people who watched the pre-call videos turn up to the call?
 *
 * The only show answer anywhere is Close's `First Call Show Up`, and it
 * describes ONE call: the lead's first sales call, dated by `First Sales Call
 * Booked Date`. A follow-up, onboarding or rescheduled booking for the same
 * person is a different call, and reading the first call's answer onto it
 * would report a show for a call nobody logged. Measured 2026-09-23 over a
 * month of bookings: 609 fall on the mirror's first-call day, 260 do not
 * (onboarding 52 of 52, reschedules 53 of 79). So an outcome is only read
 * when the booking IS that first call, matched on its day.
 */

export type FirstCallOutcome =
  /** A rep logged "yes". */
  | "held"
  /** A rep logged "no". */
  | "noShow"
  /** The call is today or ahead, or inside the grace day for logging. */
  | "pending"
  /** The call has passed and nobody logged an answer. */
  | "unlogged"
  /** This booking is not the lead's first sales call, so Close has no answer for it. */
  | "notFirstCall"
  /** Close's mirror could not be read. */
  | "unavailable";

/**
 * The first-call answer for one booking.
 *
 * The call's day is compared in both UTC and Pacific time, because Close's
 * date field carries no zone and an evening Pacific call is the next day in
 * UTC. Pure; the caller supplies the mirror rows for this email.
 */
export function firstCallOutcome(
  booking: { inviteeEmail: string | null; startAt: string | null },
  mirrorRows: FunnelShowRow[],
  today: string,
): FirstCallOutcome {
  const startMs = booking.startAt ? Date.parse(booking.startAt) : Number.NaN;
  if (!Number.isFinite(startMs)) return "notFirstCall";
  const days = new Set([
    new Date(startMs).toISOString().slice(0, 10),
    pacificDay(startMs),
  ]);
  const match = mirrorRows.find((row) =>
    days.has(row.first_sales_call_booked_date?.slice(0, 10) ?? ""),
  );
  if (!match) return "notFirstCall";

  const key = emailKey(booking.inviteeEmail);
  const { state } = classifyBookedCall(key, new Map([[key, match]]), today);
  return state;
}

/**
 * Close's mirror rows for these emails, grouped by lowercased email.
 *
 * Null on any failed batch: a partial read would quietly turn some shows into
 * "not the first call", which a reader cannot tell from the truth.
 */
export async function loadFirstCallMirror(
  emails: string[],
): Promise<Map<string, FunnelShowRow[]> | null> {
  // The mirror stores emails lowercased (0 of 8,460 were not, 2026-09-23), so
  // an exact `in` on lowercased addresses finds every row.
  const unique = [...new Set(emails.map(emailKey).filter(Boolean))];
  const byEmail = new Map<string, FunnelShowRow[]>();
  if (unique.length === 0) return byEmail;

  try {
    const client = createAdminClient();
    const batches = await Promise.all(
      chunk(unique, ID_BATCH).map((batch) =>
        client
          .from("close_lead_funnel")
          .select("email,first_sales_call_booked_date,first_call_show_up")
          .in("email", batch),
      ),
    );
    for (const { data, error } of batches) {
      if (error) return null;
      for (const row of data ?? []) {
        const key = emailKey(row.email);
        if (!key) continue;
        byEmail.set(key, [...(byEmail.get(key) ?? []), row]);
      }
    }
    return byEmail;
  } catch {
    return null;
  }
}

export type ShowUpGroup = { held: number; noShow: number };

export type ShowUpComparison = {
  /** False when Close's mirror could not be read. */
  connected: boolean;
  watched: ShowUpGroup;
  watchedNothing: ShowUpGroup;
};

/**
 * Show-up for people who opened a video against people who opened none.
 *
 * Only people we could actually observe (a session), only first calls with a
 * logged answer, and never a canceled booking. Anyone we could not see is
 * left out of both sides rather than guessed into one.
 */
export function compareShowUp(
  people: {
    hasSession: boolean;
    canceled: boolean;
    videosStarted: number;
    firstCall: FirstCallOutcome;
  }[],
  connected: boolean,
): ShowUpComparison {
  const watched: ShowUpGroup = { held: 0, noShow: 0 };
  const watchedNothing: ShowUpGroup = { held: 0, noShow: 0 };
  for (const person of people) {
    if (!person.hasSession || person.canceled) continue;
    if (person.firstCall !== "held" && person.firstCall !== "noShow") continue;
    const group = person.videosStarted > 0 ? watched : watchedNothing;
    if (person.firstCall === "held") group.held += 1;
    else group.noShow += 1;
  }
  return { connected, watched, watchedNothing };
}

function emailKey(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

function pacificDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}
