import "server-only";

import { config } from "@/lib/config";
import { verifyCalendarToken } from "@/lib/masterclass-session";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

/** Headers for every personal token route: never cached, indexed or leaked via Referer. */
export const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
};

export const privateRedirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { ...PRIVATE_HEADERS, Location: location },
  });

export type RoomToken = {
  contactId: string;
  expiresAt: number;
  /** The current room's start (ISO), the one the token was minted for. */
  startsAt: string;
};

/**
 * The contact behind a personal token (/masterclass/{cal,join,wallet}/<token>),
 * or null when it is tampered, expired, or minted for an earlier room than the
 * one GHL now holds.
 */
export async function currentRoomToken(
  token: string,
): Promise<RoomToken | null> {
  const verified = verifyCalendarToken(token, config.MASTERCLASS_CAL_SECRET);
  const event = await getMasterclassEvent();
  if (
    !verified ||
    !event.startsAt ||
    Date.parse(event.startsAt) >= verified.expiresAt
  ) {
    return null;
  }
  return { ...verified, startsAt: event.startsAt };
}
