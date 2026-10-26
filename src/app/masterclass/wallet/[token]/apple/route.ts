import { config, publicConfig } from "@/lib/config";
import {
  currentRoomToken,
  privateRedirect,
} from "@/lib/masterclass-room-token";
import { appleWalletConfig, applePassBuffer } from "@/lib/wallet/apple-wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /masterclass/wallet/<token>/apple: the confirmed page's Add to Apple
 * Wallet button. Same signed token as the Google route; returns the signed
 * .pkpass. Expired, tampered, an earlier room's token, or Apple not configured
 * -> the registration page.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const token = (await params).token;
  const room = await currentRoomToken(token);
  const cfg = appleWalletConfig(config);
  if (!room || !cfg) {
    return privateRedirect(new URL("/masterclass", request.url).toString());
  }
  try {
    const body = await applePassBuffer(cfg, {
      startsAt: room.startsAt,
      contactId: room.contactId,
      joinUrl: `${publicConfig.siteUrl}/masterclass/join/${token}`,
    });
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "content-disposition":
          'attachment; filename="vending-masterclass.pkpass"',
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    console.error("[wallet] apple pass build failed", error);
    return privateRedirect(
      new URL("/masterclass-confirmed", request.url).toString(),
    );
  }
}
