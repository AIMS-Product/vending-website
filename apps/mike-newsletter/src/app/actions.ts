"use server";

import { headers } from "next/headers";
import {
  clientIp,
  createRateLimiter,
  sanitizeSource,
} from "@/lib/signup-guard";
import { normalizeEmail, subscribe } from "@/lib/subscribe";
import type { SubscribeState } from "@/lib/subscribe-state";

const MESSAGES = {
  invalid: "That doesn't look like an email address. Mind checking it?",
  unconfigured:
    "Signups aren't connected yet. Email mike@vendingpreneurs.com and we'll add you by hand.",
  provider: "Something broke on our end. Try again in a moment.",
  rateLimited: "Too many attempts. Give it a few minutes and try again.",
} as const;

// Per server instance; see signup-guard.ts for what that does and does not cover.
const WINDOW_MS = 10 * 60 * 1000;
const ipLimiter = createRateLimiter({ limit: 8, windowMs: WINDOW_MS });
const emailLimiter = createRateLimiter({ limit: 3, windowMs: WINDOW_MS });

export async function subscribeAction(
  _previous: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  // Honeypot. A real person never sees this field, so anything in it is a bot.
  // Answer with the success screen so the bot has nothing to learn from a retry.
  if (typeof formData.get("company") === "string" && formData.get("company")) {
    return { status: "success", email: "" };
  }

  const email = normalizeEmail(formData.get("email"));
  if (!email) {
    return { status: "error", message: MESSAGES.invalid };
  }

  const ip = clientIp(await headers());
  const withinLimits =
    (ip === null || ipLimiter.take(ip)) && emailLimiter.take(email);
  if (!withinLimits) {
    return { status: "error", message: MESSAGES.rateLimited };
  }

  const source = sanitizeSource(formData.get("source"));

  const outcome = await subscribe(email, source);
  if (outcome.ok) {
    return { status: "success", email };
  }
  return { status: "error", message: MESSAGES[outcome.reason] };
}
