import { config, publicConfig } from "@/lib/config";
import {
  currentRoomToken,
  privateRedirect,
} from "@/lib/masterclass-room-token";
import { saveUrl, walletConfig } from "@/lib/wallet/google-wallet";

export const dynamic = "force-dynamic";

/**
 * GET /masterclass/wallet/<token>: the confirmed page's Add to Google Wallet
 * button. The signed token (same as the personal calendar link) names the
 * contact; the signed save link is built here, so it never sits in our HTML.
 * Expired, tampered, an earlier room's token, or wallet not configured -> the
 * registration page.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const token = (await params).token;
  const room = await currentRoomToken(token);
  const cfg = walletConfig(config);
  if (!room || !cfg) {
    return privateRedirect(new URL("/masterclass", request.url).toString());
  }
  const siteUrl = publicConfig.siteUrl;
  return privateRedirect(
    saveUrl(cfg, {
      startsAt: room.startsAt,
      contactId: room.contactId,
      joinUrl: `${siteUrl}/masterclass/join/${token}`,
      siteUrl,
    }),
  );
}
