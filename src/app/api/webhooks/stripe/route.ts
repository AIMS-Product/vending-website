import type Stripe from "stripe";
import { config } from "@/lib/config";
import { getLtfStripe, ltfOrderDeps, originOf } from "@/lib/ltf/deps";
import { handleStripeEvent } from "@/lib/ltf/orders";

/**
 * Stripe webhook for the LTF $5 playbook. The signature is checked against
 * the raw body before anything is read. 500 asks Stripe to redeliver; it is
 * returned only for errors and for a paid order whose email has not gone out.
 * Events for anything other than this test are acknowledged and ignored.
 */
export async function POST(request: Request) {
  if (!config.STRIPE_WEBHOOK_SECRET) {
    console.error("stripe webhook: STRIPE_WEBHOOK_SECRET is not set");
    return new Response("not configured", { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getLtfStripe().webhooks.constructEvent(
      body,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.warn("stripe webhook: bad signature", error);
    return new Response("bad signature", { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(
      ltfOrderDeps(originOf(request)),
      event,
    );
    if (outcome.retry) {
      return new Response("delivery pending", { status: 500 });
    }
    return Response.json({ received: true, handled: outcome.handled });
  } catch (error) {
    console.error("stripe webhook: handling failed", {
      type: event.type,
      id: event.id,
      error,
    });
    return new Response("handler error", { status: 500 });
  }
}
