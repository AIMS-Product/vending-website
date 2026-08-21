import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type RateLimitClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Per-action sliding windows for the public, unauthenticated entry points.
 *
 * Every one of these writes a row, and the lead actions also fan out to Slack,
 * Resend, and Close, so an unthrottled flood is expensive in three services at
 * once. The limits are set well above what a real visitor produces — a person
 * filling in the two-stage funnel twice still fits.
 */
const LIMITS = {
  lead_submit: { windowMs: 10 * 60 * 1000, max: 8 },
  qualification_intake: { windowMs: 10 * 60 * 1000, max: 12 },
  attribution_event: { windowMs: 60 * 1000, max: 60 },
  // Site chatbot (see .claude/specs/2026-08-20-site-chatbot.md §API): a chat
  // turn is cheap to throttle generously (60/min covers real typing speed
  // many times over); the capture-card/pre-chat-form submit reuses the same
  // stricter budget as the public lead forms it feeds.
  chatbot_chat: { windowMs: 60 * 1000, max: 60 },
  chatbot_lead: { windowMs: 60 * 60 * 1000, max: 10 },
  // One IP spinning up new conversations (not turns on an existing one) is
  // the cheap way to trip the global 2000/day cap and 503 the widget for
  // everyone else — this budget is per-IP and only spent on conversation
  // creation, so it never throttles an ongoing chat.
  chatbot_new_conversation: { windowMs: 60 * 60 * 1000, max: 15 },
} as const;

export type PublicRateLimitAction = keyof typeof LIMITS;

/** Deliberately vague: a throttled attacker learns nothing about the limits. */
export const TOO_MANY_REQUESTS_MESSAGE =
  "Too many submissions from this connection. Wait a few minutes and try again.";

/**
 * How long a hit row stays readable. Nothing past the longest window can change
 * a decision; the rest of the day exists so an abuse report can still be
 * investigated. Enforced by `prunePublicRequestHits`, called from the Close
 * sync cron.
 */
const RETENTION_MS = 24 * 60 * 60 * 1000;

export type PublicRateLimitDeps = {
  client?: RateLimitClient;
  now?: () => Date;
};

/**
 * Record one attempt and report whether it is allowed.
 *
 * Counts recent attempts sharing this request's IP *or* its email, so varying
 * one of the two does not buy a fresh budget.
 *
 * Fails OPEN: if the table is missing or the database is unreachable this
 * returns `true` and the caller behaves exactly as it did before the limiter
 * existed. Losing lead capture to a limiter outage would cost far more than
 * the flood it prevents — and the migration that creates the table is applied
 * by hand, so "table missing" is a real state this must survive.
 *
 * ponytail: check-then-insert, so a simultaneous burst can land a few requests
 * over the limit. Sized for spam, not for a strict quota — move the count and
 * the insert into one RPC if an exact ceiling is ever needed.
 */
export async function checkPublicRateLimit(
  action: PublicRateLimitAction,
  {
    ip,
    email,
  }: {
    ip: string | null;
    email?: string | null;
  },
  deps: PublicRateLimitDeps = {},
): Promise<boolean> {
  const emailHash = hashEmail(email);
  if (!ip && !emailHash) return true;

  const { windowMs, max } = LIMITS[action];
  const now = deps.now?.() ?? new Date();
  const since = new Date(now.getTime() - windowMs).toISOString();

  try {
    // Inside the try: createAdminClient throws when Supabase config is absent,
    // and that must fail open like every other failure here rather than 500
    // the submit it is guarding.
    const client = deps.client ?? createAdminClient();
    const { count, error } = await client
      .from("public_request_hits")
      .select("id", { count: "exact", head: true })
      .eq("action", action)
      .gte("occurred_at", since)
      .or(subjectFilter(ip, emailHash));
    if (error) throw new Error(error.message);

    if ((count ?? 0) >= max) return false;

    const inserted = await client.from("public_request_hits").insert({
      action,
      ip,
      email_hash: emailHash,
      occurred_at: now.toISOString(),
    });
    if (inserted.error) throw new Error(inserted.error.message);
  } catch (error) {
    console.warn("public rate limit check failed open", {
      action,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return true;
  }

  return true;
}

/** Drop hit rows past the retention window. Best-effort; never throws. */
export async function prunePublicRequestHits(
  deps: PublicRateLimitDeps = {},
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const cutoff = new Date(now.getTime() - RETENTION_MS).toISOString();

  try {
    const client = deps.client ?? createAdminClient();
    const { error } = await client
      .from("public_request_hits")
      .delete()
      .lt("occurred_at", cutoff);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("public request hit prune failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

/** PostgREST `or` takes one comma-separated string, and empty terms match everything. */
function subjectFilter(ip: string | null, emailHash: string | null) {
  return [
    ip ? `ip.eq.${ip}` : null,
    emailHash ? `email_hash.eq.${emailHash}` : null,
  ]
    .filter(Boolean)
    .join(",");
}

/**
 * Store a digest, never the address. The limiter only ever compares addresses
 * for equality, so there is no reason for this table to hold readable PII.
 */
function hashEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * The client IP as Vercel presents it. `x-forwarded-for` is attacker-supplied
 * on an origin with no proxy in front of it, but this app is only reachable
 * through Vercel's edge, which overwrites both headers. A null IP is not fatal:
 * the email half of the key still applies.
 */
export function requestIp(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}
