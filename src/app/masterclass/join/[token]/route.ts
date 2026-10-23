import { readJoinUrl } from "@/lib/masterclass-join-link";
import {
  currentRoomToken,
  privateRedirect,
} from "@/lib/masterclass-room-token";

export const dynamic = "force-dynamic";

/**
 * GET /masterclass/join/<token>: the wallet pass's Join button. Sends the
 * registrant straight to their own Zoom join link, read from GHL at tap time
 * (it may not exist yet when the pass is saved). No link yet -> the confirmed
 * page, which points them to their Zoom email. Expired or tampered -> the
 * registration page. Never registers anyone in Zoom.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const at = (path: string) => new URL(path, request.url).toString();
  const room = await currentRoomToken((await params).token);
  if (!room) return privateRedirect(at("/masterclass"));
  const joinUrl = await readJoinUrl(
    room.contactId,
    room.startsAt,
    "masterclass_join",
  );
  return privateRedirect(joinUrl ?? at("/masterclass-confirmed"));
}
