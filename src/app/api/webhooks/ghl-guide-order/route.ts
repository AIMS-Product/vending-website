import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { recordGhlOrder } from "@/lib/ltf/orders";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Version A's orders, posted by the GHL workflow that fires ONLY for the $5
 * PDF product (never the "Webinar LTF" course workflow). Shared secret in the
 * `x-ltf-secret` header. GHL sends the amount in dollars.
 */
const payloadSchema = z.object({
  order_id: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254).nullish(),
  name: z.string().trim().max(200).nullish(),
  amount: z.coerce.number().nonnegative().max(1000).nullish(),
  status: z.enum(["paid", "refunded"]).default("paid"),
});

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!config.LTF_GHL_WEBHOOK_SECRET) {
    return new Response("not configured", { status: 503 });
  }
  if (
    !secretMatches(
      request.headers.get("x-ltf-secret"),
      config.LTF_GHL_WEBHOOK_SECRET,
    )
  ) {
    return new Response("unauthorized", { status: 401 });
  }
  const parsed = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  const p = parsed.data;
  try {
    await recordGhlOrder(createAdminClient(), {
      orderId: p.order_id,
      email: p.email ?? null,
      name: p.name ?? null,
      amountCents: p.amount == null ? null : Math.round(p.amount * 100),
      status: p.status,
    });
  } catch (error) {
    console.error("ltf ghl order failed", error);
    return new Response("handler error", { status: 500 });
  }
  return Response.json({ received: true });
}
