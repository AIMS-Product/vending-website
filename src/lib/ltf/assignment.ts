import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * Visitor tracking for the $5 First Location Playbook (plans/ltf-v2-pdf-ab).
 * Every visitor to the offer gets a first-party id so conversion is buyers
 * divided by real visitors. The cookie holds only that id; it is checked
 * against `ltf_visitors` on every read.
 */
export type LtfDb = SupabaseClient<Database>;
export type LtfVisitor = { visitorId: string };
export type LtfEventKind = "offer_view" | "checkout_start";

export const LTF_COOKIE = "vp_ltf";
export const LTF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LTF_PATHS = {
  go: "/playbook/go",
  offer: "/playbook/guide",
  thanks: "/playbook/guide-thanks",
  access: "/playbook/guide-access",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python-requests|headless/i;

/**
 * The swap switch, fail closed. The offer itself is always served (unlisted,
 * at /playbook-stripe). PLAYBOOK_GUIDE_LIVE=on makes it THE playbook offer:
 * /playbook and /playbook/checkout redirect to it (next.config.ts) and the
 * webinar confirmation page shows its teaser. Previews and `next dev` show the
 * swapped state so it can be reviewed; production never swaps by a missing
 * variable.
 */
export function isGuideSwapLive(
  env: {
    PLAYBOOK_GUIDE_LIVE?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
  } = config,
): boolean {
  if (env.PLAYBOOK_GUIDE_LIVE === "on") return true;
  return env.VERCEL_ENV === "preview" || env.NODE_ENV === "development";
}

export function isBotUserAgent(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

export async function getLtfVisitor(
  db: LtfDb,
  cookieValue: string | undefined,
): Promise<LtfVisitor | null> {
  if (!cookieValue || !UUID.test(cookieValue)) return null;
  const { data, error } = await db
    .from("ltf_visitors")
    .select("visitor_id")
    .eq("visitor_id", cookieValue)
    .maybeSingle();
  if (error) throw new Error(`ltf visitor lookup failed: ${error.message}`);
  return data ? { visitorId: data.visitor_id } : null;
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
  input: { source: LtfSource; userAgent: string | null },
): Promise<LtfVisitor> {
  const visitor: LtfVisitor = { visitorId: randomUUID() };
  const { error } = await db.from("ltf_visitors").insert({
    visitor_id: visitor.visitorId,
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
