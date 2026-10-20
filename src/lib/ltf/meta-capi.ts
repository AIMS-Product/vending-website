import "server-only";
import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import type { PaidPurchase } from "@/lib/ltf/orders";
import { META_PIXEL_ID } from "@/lib/tracking/meta-pixel";

/** Browser signals the thank-you page can add; the webhook path has none. */
export type BrowserContext = {
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const norm = (value: string | null | undefined) =>
  value?.trim().toLowerCase() || null;

export function capiPurchaseEvent(
  purchase: PaidPurchase,
  sourceUrl: string,
  browser: BrowserContext = {},
  nowMs = Date.now(),
) {
  const email = norm(purchase.email);
  const phone = purchase.phone?.replace(/\D/g, "") || null;
  const [first, ...rest] = (purchase.name ?? "").trim().split(/\s+/);
  const last = rest.at(-1);
  const userData: Record<string, string[] | string> = {};
  if (email) userData.em = [sha(email)];
  if (phone) userData.ph = [sha(phone)];
  if (first) userData.fn = [sha(first.toLowerCase())];
  if (last) userData.ln = [sha(last.toLowerCase())];
  if (browser.ip) userData.client_ip_address = browser.ip;
  if (browser.userAgent) userData.client_user_agent = browser.userAgent;
  if (browser.fbp) userData.fbp = browser.fbp;
  if (browser.fbc) userData.fbc = browser.fbc;
  return {
    event_name: "Purchase",
    event_time: Math.floor(nowMs / 1000),
    // Same id the browser pixel sends, so Meta counts the purchase once.
    event_id: purchase.sessionId,
    action_source: "website",
    event_source_url: sourceUrl,
    user_data: userData,
    custom_data: {
      value: (purchase.amountCents ?? 0) / 100,
      currency: (purchase.currency ?? "usd").toUpperCase(),
      content_name: "The First Location Playbook",
      content_ids: ["first-location-playbook"],
      content_type: "product",
      order_id: purchase.sessionId,
    },
  };
}

/**
 * Server-side Meta Purchase (Conversions API). Live payments only, so Stripe
 * test purchases never train the ad account. Fail-soft: logs, never throws.
 */
export async function sendMetaPurchase(
  purchase: PaidPurchase,
  sourceUrl: string,
  browser?: BrowserContext,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!purchase.livemode) return;
  if (!config.META_ACCESS_TOKEN) {
    console.warn("ltf meta capi skipped: META_ACCESS_TOKEN is not set");
    return;
  }
  try {
    const body = new URLSearchParams({
      access_token: config.META_ACCESS_TOKEN,
      data: JSON.stringify([capiPurchaseEvent(purchase, sourceUrl, browser)]),
    });
    const res = await fetchImpl(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`,
      {
        method: "POST",
        body,
      },
    );
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      console.error("ltf meta capi rejected", {
        status: res.status,
        text,
        sessionId: purchase.sessionId,
      });
    }
  } catch (error) {
    console.error("ltf meta capi failed", {
      sessionId: purchase.sessionId,
      error,
    });
  }
}
