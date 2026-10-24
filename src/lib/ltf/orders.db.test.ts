/**
 * LTF V2 order invariants against a REAL Postgres (the conditional UPDATEs
 * are the safety mechanism, so they are not mocked). Stripe is faked: it is
 * the external boundary, and its contract is "retrieve says paid or not".
 *
 * Runs when LTF_TEST_SUPABASE_URL + LTF_TEST_SUPABASE_SERVICE_KEY point at a
 * local stack with supabase/migrations/20261020002951_ltf_playbook_test.sql
 * applied (see plans/ltf-v2-pdf-ab/slice-plan.md "Local test DB"). Skipped
 * otherwise. Never point it at production: it deletes ltf_* rows it created.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import type { LtfDb } from "@/lib/ltf/assignment";
import { assignLtfVisitor, recordLtfEvent } from "@/lib/ltf/assignment";
import { loadLtfReport } from "@/lib/ltf/report";
import {
  createStripeCheckout,
  findDownloadableOrder,
  fulfillCheckoutSession,
  handleStripeEvent,
  LTF_METADATA_KEY,
  LTF_METADATA_VALUE,
  resendAccess,
  type DeliveryEmail,
  type LtfOrderDeps,
} from "@/lib/ltf/orders";

const url = process.env.LTF_TEST_SUPABASE_URL;
const key = process.env.LTF_TEST_SUPABASE_SERVICE_KEY;
const enabled = Boolean(url && key && /127\.0\.0\.1|localhost/.test(url ?? ""));

type FakeSession = {
  id: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status?: "open" | "complete";
  amount_total?: number;
  metadata: Record<string, string>;
  email: string;
};

function fakeStripe() {
  const sessions = new Map<string, FakeSession>();
  const byIdempotency = new Map<string, string>();
  let creates = 0;
  const toStripe = (s: FakeSession) =>
    ({
      id: s.id,
      object: "checkout.session",
      url: `https://checkout.stripe.com/c/pay/${s.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
      currency: "usd",
      amount_total: s.amount_total ?? 500,
      status: s.status ?? "open",
      payment_status: s.payment_status,
      metadata: s.metadata,
      customer_details: { email: s.email, name: "Test Buyer" },
      customer_email: null,
      payment_intent: {
        id: `pi_${s.id}`,
        latest_charge: { balance_transaction: { fee: 45 } },
      },
    }) as unknown as Stripe.Checkout.Session;

  const stripe = {
    checkout: {
      sessions: {
        async create(
          params: Stripe.Checkout.SessionCreateParams,
          opts?: { idempotencyKey?: string },
        ) {
          const prior =
            opts?.idempotencyKey && byIdempotency.get(opts.idempotencyKey);
          if (prior) return toStripe(sessions.get(prior)!);
          creates += 1;
          const s: FakeSession = {
            id: `cs_test_${randomUUID().replaceAll("-", "")}`,
            payment_status: "unpaid",
            metadata: (params.metadata ?? {}) as Record<string, string>,
            email: `Buyer+${randomUUID().slice(0, 8)}@Example.com`,
          };
          sessions.set(s.id, s);
          if (opts?.idempotencyKey)
            byIdempotency.set(opts.idempotencyKey, s.id);
          return toStripe(s);
        },
        async retrieve(id: string) {
          const s = sessions.get(id);
          if (!s) throw new Error(`no such session ${id}`);
          return toStripe(s);
        },
      },
    },
  } as unknown as Stripe;
  return {
    stripe,
    sessions,
    pay: (id: string) => {
      sessions.get(id)!.payment_status = "paid";
    },
    creates: () => creates,
  };
}

function mailer(failTimes = 0) {
  const sent: DeliveryEmail[] = [];
  let attempts = 0;
  const send = async (email: DeliveryEmail) => {
    attempts += 1;
    if (attempts <= failTimes)
      return { ok: false as const, error: "resend down" };
    sent.push(email);
    return { ok: true as const };
  };
  return { send, sent, attempts: () => attempts };
}

describe.skipIf(!enabled)("ltf orders (real Postgres)", () => {
  const db = enabled
    ? (createClient<Database>(url!, key!, {
        auth: { persistSession: false },
      }) as LtfDb)
    : (null as unknown as LtfDb);
  const visitors: string[] = [];

  let fake: ReturnType<typeof fakeStripe>;
  let mail: ReturnType<typeof mailer>;
  let deps: LtfOrderDeps;

  beforeEach(() => {
    fake = fakeStripe();
    mail = mailer();
    deps = {
      db,
      stripe: fake.stripe,
      sendEmail: mail.send,
      siteOrigin: "http://localhost:3000",
    };
  });

  afterAll(async () => {
    if (!enabled || !visitors.length) return;
    await db.from("ltf_orders").delete().in("visitor_id", visitors);
    await db.from("ltf_events").delete().in("visitor_id", visitors);
    await db.from("ltf_visitors").delete().in("visitor_id", visitors);
  });

  async function newVisitor() {
    const v = await assignLtfVisitor(db, {
      source: { utm_source: "webinar", utm_campaign: "oct21" },
      userAgent: "Mozilla/5.0",
    });
    visitors.push(v.visitorId);
    return v;
  }

  async function checkout(visitorId: string) {
    return createStripeCheckout(deps, {
      visitorId,
      priceId: "price_test",
      siteOrigin: deps.siteOrigin,
      utmSource: "webinar",
      utmCampaign: "oct21",
    });
  }

  const sessionIdOf = (checkoutUrl: string) => checkoutUrl.split("/").pop()!;

  async function orderFor(sessionId: string) {
    const { data, error } = await db
      .from("ltf_orders")
      .select("*")
      .eq("external_id", sessionId);
    if (error) throw error;
    return data;
  }

  const completed = (id: string) =>
    ({
      id: `evt_${randomUUID()}`,
      type: "checkout.session.completed",
      data: {
        object: { id, metadata: { [LTF_METADATA_KEY]: LTF_METADATA_VALUE } },
      },
    }) as unknown as Stripe.Event;

  it("repeat and concurrent clicks give one session and one order", async () => {
    const v = await newVisitor();
    const [a, b] = await Promise.all([
      checkout(v.visitorId),
      checkout(v.visitorId),
    ]);
    const c = await checkout(v.visitorId);
    expect(new Set([a, b, c]).size).toBe(1);
    expect(fake.creates()).toBe(1);
    expect(await orderFor(sessionIdOf(a))).toHaveLength(1);
  });

  it("an unpaid session unlocks nothing and sends nothing", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    expect(await fulfillCheckoutSession(deps, sid)).toEqual({
      status: "unpaid",
    });
    const [order] = await orderFor(sid);
    expect(order.payment_status).toBe("pending");
    expect(await findDownloadableOrder(db, order.access_token)).toBeNull();
    expect(mail.attempts()).toBe(0);
  });

  it("thank-you page + webhook + replays deliver exactly once", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    const page = await fulfillCheckoutSession(deps, sid);
    await handleStripeEvent(deps, completed(sid));
    await handleStripeEvent(deps, completed(sid));
    expect(page).toMatchObject({ status: "paid", delivery: "sent" });
    expect(mail.sent).toHaveLength(1);
    const [order] = await orderFor(sid);
    expect(order).toMatchObject({
      payment_status: "paid",
      delivery_status: "sent",
      amount_cents: 500,
      fee_cents: 45,
    });
    expect(order.email).toBe(order.email?.toLowerCase());
    expect(mail.sent[0].downloadUrl).toContain(order.access_token);
    expect(await findDownloadableOrder(db, order.access_token)).not.toBeNull();
  });

  it("five concurrent fulfillments send one email and one ad conversion", async () => {
    const paid: string[] = [];
    const d = {
      ...deps,
      onPaid: async (p: { sessionId: string }) => {
        paid.push(p.sessionId);
      },
    };
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => fulfillCheckoutSession(d, sid)),
    );
    await fulfillCheckoutSession(d, sid);
    expect(paid).toEqual([sid]);
    expect(mail.sent).toHaveLength(1);
    expect(results.every((r) => r.status === "paid")).toBe(true);
    expect(await orderFor(sid)).toHaveLength(1);
  });

  it("closed browser: the webhook alone delivers", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    expect(await handleStripeEvent(deps, completed(sid))).toEqual({
      handled: true,
      retry: false,
    });
    expect(mail.sent).toHaveLength(1);
  });

  it("a failed email asks Stripe to retry, and the retry delivers", async () => {
    const failing = mailer(1);
    const d = { ...deps, sendEmail: failing.send };
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    expect(await handleStripeEvent(d, completed(sid))).toEqual({
      handled: true,
      retry: true,
    });
    let [order] = await orderFor(sid);
    expect(order).toMatchObject({
      payment_status: "paid",
      delivery_status: "failed",
    });
    // Paid but not emailed: the download still works from the thank-you page.
    expect(await findDownloadableOrder(db, order.access_token)).not.toBeNull();
    expect(await handleStripeEvent(d, completed(sid))).toEqual({
      handled: true,
      retry: false,
    });
    [order] = await orderFor(sid);
    expect(order.delivery_status).toBe("sent");
    expect(failing.sent).toHaveLength(1);
  });

  it("recreates a lost order row from the session and delivers", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    await db.from("ltf_orders").delete().eq("external_id", sid);
    fake.pay(sid);
    const result = await fulfillCheckoutSession(deps, sid);
    expect(result).toMatchObject({ status: "paid", delivery: "sent" });
    const [order] = await orderFor(sid);
    expect(order.visitor_id).toBe(v.visitorId);
  });

  it("ignores sessions that are not this test's", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.sessions.get(sid)!.metadata = { other: "product" };
    fake.pay(sid);
    expect(await fulfillCheckoutSession(deps, sid)).toEqual({
      status: "not_ltf",
    });
    expect(mail.attempts()).toBe(0);
  });

  it("a full refund revokes access; a partial refund does not", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    await fulfillCheckoutSession(deps, sid);
    const [order] = await orderFor(sid);
    const refund = (amount_refunded: number) =>
      ({
        id: `evt_${randomUUID()}`,
        type: "charge.refunded",
        data: {
          object: {
            payment_intent: `pi_${sid}`,
            amount: 500,
            amount_refunded,
            refunded: amount_refunded >= 500,
          },
        },
      }) as unknown as Stripe.Event;

    await handleStripeEvent(deps, refund(200));
    expect(await findDownloadableOrder(db, order.access_token)).not.toBeNull();
    await handleStripeEvent(deps, refund(500));
    expect(await findDownloadableOrder(db, order.access_token)).toBeNull();
    // A late webhook replay after the refund must not re-deliver or re-open.
    expect(await fulfillCheckoutSession(deps, sid)).toEqual({
      status: "refunded",
    });
    expect(mail.sent).toHaveLength(1);
  });

  it("expired and failed payments are recorded, never unlocked", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    await handleStripeEvent(deps, {
      type: "payment_intent.payment_failed",
      data: {
        object: {
          metadata: {
            [LTF_METADATA_KEY]: LTF_METADATA_VALUE,
            visitor_id: v.visitorId,
          },
        },
      },
    } as unknown as Stripe.Event);
    await handleStripeEvent(deps, {
      type: "checkout.session.expired",
      data: {
        object: {
          id: sid,
          metadata: { [LTF_METADATA_KEY]: LTF_METADATA_VALUE },
        },
      },
    } as unknown as Stripe.Event);
    const [order] = await orderFor(sid);
    expect(order).toMatchObject({
      payment_status: "expired",
      payment_failures: 1,
      checkout_url: null,
    });
    expect(await findDownloadableOrder(db, order.access_token)).toBeNull();
  });

  it("recovery emails paid buyers only, case-insensitively", async () => {
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    await fulfillCheckoutSession(deps, sid);
    const email = fake.sessions.get(sid)!.email;
    const recover = mailer();
    const d = { db, sendEmail: recover.send, siteOrigin: deps.siteOrigin };
    expect(await resendAccess(d, email.toUpperCase())).toEqual({ sent: 1 });
    expect(await resendAccess(d, "nobody@example.com")).toEqual({ sent: 0 });

    const unpaid = await newVisitor();
    const unpaidSid = sessionIdOf(await checkout(unpaid.visitorId));
    expect(await resendAccess(d, fake.sessions.get(unpaidSid)!.email)).toEqual({
      sent: 0,
    });
  });

  it("bad and unknown download tokens unlock nothing", async () => {
    expect(await findDownloadableOrder(db, null)).toBeNull();
    expect(await findDownloadableOrder(db, "short")).toBeNull();
    expect(await findDownloadableOrder(db, "x".repeat(32))).toBeNull();
  });

  it("the report counts visitors, starts, buyers and net", async () => {
    const before = await loadLtfReport(db);
    const v = await newVisitor();
    await recordLtfEvent(db, v.visitorId, "checkout_start");
    await recordLtfEvent(db, v.visitorId, "checkout_start");
    const sid = sessionIdOf(await checkout(v.visitorId));
    fake.pay(sid);
    await fulfillCheckoutSession(deps, sid);
    const bot = await assignLtfVisitor(db, {
      source: {},
      userAgent: "Slackbot 1.0",
    });
    visitors.push(bot.visitorId);

    const after = await loadLtfReport(db);
    const b0 = before;
    const b1 = after;
    expect(b1.visitors - b0.visitors).toBe(1);
    expect(b1.checkoutStarts - b0.checkoutStarts).toBe(1);
    expect(b1.buyers - b0.buyers).toBe(1);
    expect(b1.grossCents - b0.grossCents).toBe(500);
    expect(b1.netCents - b0.netCents).toBe(455);
  });

  it("a 100% off promo order delivers once and sends no ad conversion", async () => {
    const before = await loadLtfReport(db);
    const paid: string[] = [];
    const d = {
      ...deps,
      onPaid: async (p: { sessionId: string }) => void paid.push(p.sessionId),
    };
    const v = await newVisitor();
    const sid = sessionIdOf(await checkout(v.visitorId));
    const session = fake.sessions.get(sid)!;
    // Open but not completed: still nothing to unlock.
    session.payment_status = "no_payment_required";
    expect(await fulfillCheckoutSession(d, sid)).toEqual({ status: "unpaid" });
    session.status = "complete";
    session.amount_total = 0;
    const result = await fulfillCheckoutSession(d, sid);
    await handleStripeEvent(d, completed(sid));
    expect(result).toMatchObject({
      status: "paid",
      delivery: "sent",
      amountCents: 0,
    });
    expect(mail.sent).toHaveLength(1);
    expect(paid).toEqual([]);
    // A $0 order is delivered but is not a buyer (10-20: test orders inflated conversion).
    const after = await loadLtfReport(db);
    expect(after.buyers - before.buyers).toBe(0);
    expect(after.freeOrders - before.freeOrders).toBe(1);
  });
});
