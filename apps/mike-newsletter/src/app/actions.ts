"use server";

import { normalizeEmail, subscribe } from "@/lib/subscribe";
import type { SubscribeState } from "@/lib/subscribe-state";

const MESSAGES = {
  invalid: "That doesn't look like an email address. Mind checking it?",
  unconfigured:
    "Signups aren't connected yet. Email mike@vendingpreneurs.com and we'll add you by hand.",
  provider: "Something broke on our end. Try again in a moment.",
} as const;

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

  const source =
    typeof formData.get("source") === "string"
      ? String(formData.get("source"))
      : "site";

  const outcome = await subscribe(email, source);
  if (outcome.ok) {
    return { status: "success", email };
  }
  return { status: "error", message: MESSAGES[outcome.reason] };
}
