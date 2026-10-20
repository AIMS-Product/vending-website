import "server-only";
import { headers } from "next/headers";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { resendDeliverySender } from "@/lib/ltf/delivery-email";
import { sendMetaPurchase, type BrowserContext } from "@/lib/ltf/meta-capi";
import type { LtfOrderDeps } from "@/lib/ltf/orders";
import { createAdminClient } from "@/lib/supabase/admin";

let stripe: Stripe | null = null;

/** Stripe client for the LTF test. Fails closed when the key is missing. */
export function getLtfStripe(): Stripe {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  stripe ??= new Stripe(config.STRIPE_SECRET_KEY);
  return stripe;
}

/**
 * Links in emails and Stripe redirects use the request's own origin, so a
 * local or preview run sends buyers back to itself, not to production.
 */
export const originOf = (request: Request) => new URL(request.url).origin;

/** The same origin for a Server Component, read from the request headers. */
export async function pageOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Browser signals for the server-side Meta event, from the page request. */
export async function pageBrowserContext(): Promise<BrowserContext> {
  const h = await headers();
  const cookie = (name: string) =>
    h.get("cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1] ?? null;
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
    fbp: cookie("_fbp"),
    fbc: cookie("_fbc"),
  };
}

export function ltfOrderDeps(
  siteOrigin: string,
  browser?: BrowserContext,
): LtfOrderDeps {
  return {
    db: createAdminClient(),
    stripe: getLtfStripe(),
    sendEmail: resendDeliverySender(siteOrigin),
    siteOrigin,
    onPaid: (purchase) =>
      sendMetaPurchase(
        purchase,
        `${siteOrigin}/playbook/guide-thanks`,
        browser,
      ),
  };
}
