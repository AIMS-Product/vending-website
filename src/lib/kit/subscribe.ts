import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDuplicateDedupeError } from "@/lib/close/dedupe";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * Website newsletter signups -> Kit (the MrPassive account that sends The
 * Route). Every active Kit subscriber gets the broadcasts, so subscribing is
 * the whole job; the tag only records that the person came from this site.
 *
 * Rides the close_sync_events outbox for claim/backoff/dead-lettering. One
 * event per lead, ever (dedupe key), and the email is read from the lead row
 * at drain time.
 */
export const KIT_SUBSCRIBE_EVENT_TYPE = "kit_subscribe";
/** Kit tag "Vendingpreneurs.com Website Signup", created 2026-10-01. */
export const KIT_WEBSITE_SIGNUP_TAG_ID = 24194068;
const KIT_API = "https://api.kit.com/v4";

export type KitEnv = { KIT_API_KEY?: string };
type QueueClient = Pick<SupabaseClient<Database>, "from">;

export class KitSubscribeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KitSubscribeError";
  }
}

/**
 * Fail-soft: the signup is already stored, and before the event_type CHECK
 * migration (20261001120000) is applied the insert is rejected. Neither may
 * fail a form submit.
 */
export async function queueKitSubscribe(
  client: QueueClient,
  input: { leadSubmissionId: string; nowIso: string },
  env: KitEnv = config,
): Promise<"queued" | "exists" | "disabled" | "failed"> {
  if (!env.KIT_API_KEY) return "disabled";
  try {
    const { error } = await client
      .from("close_sync_events")
      .insert({
        lead_submission_id: input.leadSubmissionId,
        event_type: KIT_SUBSCRIBE_EVENT_TYPE,
        status: "pending",
        dedupe_key: `${KIT_SUBSCRIBE_EVENT_TYPE}:${input.leadSubmissionId}`,
        next_retry_at: input.nowIso,
        payload: {},
      })
      .select("id")
      .single();
    if (!error) return "queued";
    if (isDuplicateDedupeError(error)) return "exists";
    console.warn("kit subscribe: could not queue", {
      leadSubmissionId: input.leadSubmissionId,
      code: error.code,
    });
    return "failed";
  } catch (error) {
    console.warn("kit subscribe: could not queue", {
      leadSubmissionId: input.leadSubmissionId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

/** Upsert the subscriber, then tag. Throws on non-2xx so the queue retries. */
export async function subscribeToKit(
  subscriber: { email: string; fullName: string | null },
  env: KitEnv = config,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!env.KIT_API_KEY) {
    throw new KitSubscribeError("KIT_API_KEY is not configured.");
  }
  const email = subscriber.email.trim().toLowerCase();
  const firstName = subscriber.fullName?.trim().split(/\s+/)[0] || undefined;
  const post = async (path: string, body: Record<string, unknown>) => {
    const response = await fetchImpl(`${KIT_API}${path}`, {
      method: "POST",
      headers: {
        "X-Kit-Api-Key": env.KIT_API_KEY as string,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new KitSubscribeError(
        `Kit ${path} failed with ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
        response.status,
      );
    }
  };
  await post("/subscribers", { email_address: email, first_name: firstName });
  await post(`/tags/${KIT_WEBSITE_SIGNUP_TAG_ID}/subscribers`, {
    email_address: email,
  });
}
