import "server-only";
import { config } from "@/lib/config";
import { tagPlaybookBuyer } from "@/lib/ghl/webinar-registration";
import type { PaidPurchase } from "@/lib/ltf/orders";

/**
 * Marks a live buyer in GHL so the "you're missing out" email skips them.
 * Fail-soft like the Meta purchase: logs, never throws, never blocks delivery.
 */
export async function tagBuyerInGhl(
  purchase: PaidPurchase,
  tag: typeof tagPlaybookBuyer = tagPlaybookBuyer,
): Promise<void> {
  if (!purchase.livemode || !purchase.email) return;
  if (!config.GHL_WRITE_TOKEN || !config.GHL_LOCATION_ID) {
    console.warn(
      "ltf ghl buyer tag skipped: GHL_WRITE_TOKEN or GHL_LOCATION_ID is not set",
    );
    return;
  }
  try {
    const tagged = await tag(purchase.email.trim().toLowerCase(), {
      token: config.GHL_WRITE_TOKEN,
      locationId: config.GHL_LOCATION_ID,
    });
    if (!tagged) {
      console.warn("ltf ghl buyer tag: no GHL contact for this buyer", {
        sessionId: purchase.sessionId,
      });
    }
  } catch (error) {
    console.error("ltf ghl buyer tag failed", {
      sessionId: purchase.sessionId,
      error,
    });
  }
}
