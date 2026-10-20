import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_vitest_placeholder";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_vitest_secret";
});

const { POST } = await import("./route");

const payload = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "customer.created",
  data: { object: { id: "cus_test" } },
});

const post = (headers: Record<string, string>, body = payload) =>
  POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers,
      body,
    }),
  );

describe("POST /api/webhooks/stripe", () => {
  it("rejects a missing signature", async () => {
    expect((await post({})).status).toBe(400);
  });

  it("rejects a forged signature", async () => {
    const forged = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_someone_else",
    });
    expect((await post({ "stripe-signature": forged })).status).toBe(400);
  });

  it("rejects a valid signature over a different body", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_vitest_secret",
    });
    const tampered = payload.replace("cus_test", "cus_other");
    expect((await post({ "stripe-signature": header }, tampered)).status).toBe(
      400,
    );
  });

  it("acknowledges a signed event it does not handle", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_vitest_secret",
    });
    const res = await post({ "stripe-signature": header });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: false });
  });
});
