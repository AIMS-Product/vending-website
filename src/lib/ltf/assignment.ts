import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * LTF V2 A/B assignment (plans/ltf-v2-pdf-ab). Both versions sell the same $5
 * PDF from the same offer page; only the checkout differs:
 *   a = GHL checkout embed, b = Stripe-hosted Checkout.
 * The cookie holds only the visitor id. The version is always read back from
 * `ltf_visitors`, so a hand-edited cookie cannot pick a version.
 */
export type LtfDb = SupabaseClient<Database>;
export type LtfVariant = "a" | "b";
export type LtfVisitor = { visitorId: string; variant: LtfVariant };
export type LtfEventKind = "offer_view" | "checkout_start";

export const LTF_COOKIE = "vp_ltf";
export const LTF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LTF_PATHS = {
  go: "/playbook/go",
  offer: "/playbook/guide",
  ghlCheckout: "/playbook/guide-checkout",
  thanks: "/playbook/guide-thanks",
  access: "/playbook/guide-access",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python-requests|headless/i;

/**
 * The launch switch, fail closed. Serves the test only with
 * PLAYBOOK_PDF_TEST=on, on a Vercel preview, or under `next dev`, so it can be
 * tested before launch and never opens in production by a missing variable.
 * Switching it off closes new visits and checkouts only: thank-you, download,
 * recovery and webhooks keep working for buyers.
 */
export function isLtfTestOpen(
  env: {
    PLAYBOOK_PDF_TEST?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
  } = config,
): boolean {
  if (env.PLAYBOOK_PDF_TEST === "on") return true;
  return env.VERCEL_ENV === "preview" || env.NODE_ENV === "development";
}

export function isBotUserAgent(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export function pickVariant(roll: number = randomInt(2)): LtfVariant {
  return roll === 0 ? "a" : "b";
}

export async function getLtfVisitor(
  db: LtfDb,
  cookieValue: string | undefined,
): Promise<LtfVisitor | null> {
  if (!cookieValue || !UUID.test(cookieValue)) return null;
  const { data, error } = await db
    .from("ltf_visitors")
    .select("visitor_id, variant")
    .eq("visitor_id", cookieValue)
    .maybeSingle();
  if (error) throw new Error(`ltf visitor lookup failed: ${error.message}`);
  if (!data || (data.variant !== "a" && data.variant !== "b")) return null;
  return { visitorId: data.visitor_id, variant: data.variant };
}

export type LtfSource = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
};

const clip = (value: string | null | undefined) =>
  value ? value.trim().slice(0, 200) || null : null;

export async function assignLtfVisitor(
  db: LtfDb,
  input: { source: LtfSource; userAgent: string | null; roll?: number },
): Promise<LtfVisitor> {
  const visitor: LtfVisitor = {
    visitorId: randomUUID(),
    variant: pickVariant(input.roll),
  };
  const { error } = await db.from("ltf_visitors").insert({
    visitor_id: visitor.visitorId,
    variant: visitor.variant,
    utm_source: clip(input.source.utm_source),
    utm_medium: clip(input.source.utm_medium),
    utm_campaign: clip(input.source.utm_campaign),
    utm_content: clip(input.source.utm_content),
    is_bot: isBotUserAgent(input.userAgent),
  });
  if (error) throw new Error(`ltf visitor insert failed: ${error.message}`);
  return visitor;
}

/** Once per visitor per kind; a reload or a second click is not a new step. */
export async function recordLtfEvent(
  db: LtfDb,
  visitorId: string,
  kind: LtfEventKind,
): Promise<void> {
  const { error } = await db
    .from("ltf_events")
    .upsert(
      { visitor_id: visitorId, kind },
      { onConflict: "visitor_id,kind", ignoreDuplicates: true },
    );
  if (error) throw new Error(`ltf event ${kind} failed: ${error.message}`);
}
