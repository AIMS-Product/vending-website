import "server-only";
import { headers } from "next/headers";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { resendDeliverySender } from "@/lib/ltf/delivery-email";
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

export function ltfOrderDeps(siteOrigin: string): LtfOrderDeps {
  return {
    db: createAdminClient(),
    stripe: getLtfStripe(),
    sendEmail: resendDeliverySender(siteOrigin),
    siteOrigin,
  };
}
