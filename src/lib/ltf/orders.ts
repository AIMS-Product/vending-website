import "server-only";
import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import type { LtfDb } from "@/lib/ltf/assignment";

/**
 * LTF V2 orders (plans/ltf-v2-pdf-ab). Invariant: only a Stripe Checkout
 * Session that Stripe itself reports as paid unlocks the PDF, and one paid
 * session is one order and one delivery email, whatever mix of thank-you page
 * loads, webhook deliveries and retries arrives, in any order, concurrently.
 *
 * Every state change is a conditional UPDATE (`... where payment_status =
 * 'pending'`, `... where delivery_status in (...)`), so the database decides
 * which caller wins; nothing here reads a status and then writes it.
 */
export const LTF_METADATA_KEY = "ltf";
export const LTF_METADATA_VALUE = "v2-pdf";
/** A delivery claimed this long ago without finishing is treated as crashed. */
const STALE_SENDING_MS = 10 * 60 * 1000;
/** Reuse an open session only while it has this long left before Stripe expires it. */
const REUSE_MARGIN_MS = 5 * 60 * 1000;

export type DeliveryEmail = {
  to: string;
  name: string | null;
  downloadUrl: string;
};
export type SendDeliveryEmail = (
  email: DeliveryEmail,
) => Promise<{ ok: true } | { ok: false; error: string }>;

export type LtfOrderDeps = {
  db: LtfDb;
  stripe: Stripe;
  sendEmail: SendDeliveryEmail;
  /** Absolute origin for links in the email, e.g. https://www.vendingpreneurs.com */
  siteOrigin: string;
  now?: () => Date;
  /**
   * Runs once per order, for the caller that wins the paid transition (ad
   * conversion events). Must not throw into fulfillment: errors are logged.
   */
  onPaid?: (purchase: PaidPurchase) => Promise<void>;
};

export type PaidPurchase = {
  sessionId: string;
  livemode: boolean;
  email: string | null;
  phone: string | null;
  name: string | null;
  amountCents: number | null;
  currency: string | null;
};

export const newAccessToken = () => randomBytes(24).toString("base64url");

export const downloadUrlFor = (siteOrigin: string, token: string) =>
  `${siteOrigin}/api/playbook-guide/download?token=${encodeURIComponent(token)}`;

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export type CreateCheckoutInput = {
  visitorId: string;
  priceId: string;
  siteOrigin: string;
  utmSource: string | null;
  utmCampaign: string | null;
};

/**
 * Returns the hosted Checkout URL for a version-B visitor. Repeat clicks reuse
 * the visitor's still-open session; concurrent clicks share one Stripe
 * idempotency key, so Stripe hands both the same session and the unique
 * external_id (session id) key keeps one order row.
 */
export async function createStripeCheckout(
  deps: Pick<LtfOrderDeps, "db" | "stripe" | "now">,
  input: CreateCheckoutInput,
): Promise<string> {
  const now = deps.now?.() ?? new Date();
  const open = await deps.db
    .from("ltf_orders")
    .select("checkout_url, checkout_expires_at")
    .eq("visitor_id", input.visitorId)
    .eq("payment_status", "pending")
    .gt(
      "checkout_expires_at",
      new Date(now.getTime() + REUSE_MARGIN_MS).toISOString(),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open.error) {
    throw new Error(`ltf open checkout lookup failed: ${open.error.message}`);
  }
  if (open.data?.checkout_url) return open.data.checkout_url;

  const metadata = {
    [LTF_METADATA_KEY]: LTF_METADATA_VALUE,
    visitor_id: input.visitorId,
    utm_source: input.utmSource ?? "",
    utm_campaign: input.utmCampaign ?? "",
  };
  // One key per visitor per 10 minutes: a double click inside the window
  // gets Stripe's stored response instead of a second session.
  const bucket = Math.floor(now.getTime() / (10 * 60 * 1000));
  const session = await deps.stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: input.priceId, quantity: 1 }],
      client_reference_id: input.visitorId,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${input.siteOrigin}/playbook/guide-thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.siteOrigin}/playbook/guide?canceled=1`,
      submit_type: "pay",
      billing_address_collection: "auto",
      // The sales team calls buyers; a $5 buyer is a serious one.
      phone_number_collection: { enabled: true },
      custom_text: {
        submit: {
          message:
            "Instant PDF download right after payment, plus a copy by email. Digital product, all sales final.",
        },
      },
    },
    { idempotencyKey: `ltf-checkout-${input.visitorId}-${bucket}` },
  );
  if (!session.url) throw new Error("Stripe returned a session without a URL");

  const inserted = await deps.db.from("ltf_orders").upsert(
    {
      external_id: session.id,
      visitor_id: input.visitorId,
      utm_source: input.utmSource,
      utm_campaign: input.utmCampaign,
      checkout_url: session.url,
      checkout_expires_at: new Date(session.expires_at * 1000).toISOString(),
      currency: session.currency,
      amount_cents: session.amount_total,
      access_token: newAccessToken(),
    },
    { onConflict: "external_id", ignoreDuplicates: true },
  );
  if (inserted.error) {
    throw new Error(`ltf order insert failed: ${inserted.error.message}`);
  }
  return session.url;
}

/* ------------------------------------------------------------------ */
/* Fulfillment                                                         */
/* ------------------------------------------------------------------ */

export type FulfillResult =
  | { status: "not_ltf" }
  | { status: "unpaid" }
  | { status: "refunded" }
  | {
      status: "paid";
      accessToken: string;
      email: string | null;
      name: string | null;
      livemode: boolean;
      amountCents: number | null;
      currency: string | null;
      delivery: "sent" | "already_sent" | "in_progress" | "failed";
    };

const isLtfSession = (session: Stripe.Checkout.Session) =>
  session.metadata?.[LTF_METADATA_KEY] === LTF_METADATA_VALUE;

function feeFromSession(session: Stripe.Checkout.Session): number | null {
  const intent = session.payment_intent;
  if (!intent || typeof intent === "string") return null;
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") return null;
  const txn = charge.balance_transaction;
  if (!txn || typeof txn === "string") return null;
  return txn.fee;
}

/**
 * The one fulfillment path, shared by the webhook and the thank-you page
 * (Stripe's recommended pattern). Always re-reads the session from Stripe:
 * the caller's copy, a URL parameter or an event body is never trusted for
 * payment status.
 */
export async function fulfillCheckoutSession(
  deps: LtfOrderDeps,
  sessionId: string,
): Promise<FulfillResult> {
  const session = await deps.stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge.balance_transaction"],
  });
  if (!isLtfSession(session)) return { status: "not_ltf" };
  if (session.payment_status !== "paid") return { status: "unpaid" };

  const order = await ensureOrderRow(deps.db, session);
  if (order.payment_status === "refunded") return { status: "refunded" };

  const now = (deps.now?.() ?? new Date()).toISOString();
  const rawEmail =
    session.customer_details?.email ?? session.customer_email ?? null;
  // Stored lower-case so recovery can match it exactly.
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // pending/expired/failed -> paid, once. Losing this race is fine: the
  // winner already recorded the same facts.
  const transition = await deps.db
    .from("ltf_orders")
    .update({
      payment_status: "paid",
      paid_at: now,
      email,
      name: session.customer_details?.name ?? null,
      phone: session.customer_details?.phone ?? null,
      amount_cents: session.amount_total,
      currency: session.currency,
      fee_cents: feeFromSession(session),
      payment_intent_id: paymentIntentId,
      updated_at: now,
    })
    .eq("id", order.id)
    .in("payment_status", ["pending", "expired", "failed"])
    .select("id");
  if (transition.error) {
    throw new Error(`ltf paid transition failed: ${transition.error.message}`);
  }

  const purchase: PaidPurchase = {
    sessionId: session.id,
    livemode: session.livemode,
    email,
    phone: session.customer_details?.phone ?? null,
    name: session.customer_details?.name ?? null,
    amountCents: session.amount_total,
    currency: session.currency,
  };
  if (transition.data?.length && deps.onPaid) {
    try {
      await deps.onPaid(purchase);
    } catch (error) {
      console.error("ltf onPaid hook failed", { sessionId: session.id, error });
    }
  }

  const delivery = await deliverOnce(deps, order.id, email, order.access_token);
  return {
    status: "paid",
    accessToken: order.access_token,
    email,
    name: purchase.name,
    livemode: session.livemode,
    amountCents: session.amount_total,
    currency: session.currency,
    delivery,
  };
}

type OrderRow = {
  id: string;
  access_token: string;
  payment_status: string;
  delivery_status: string;
};

/** The row normally exists from checkout creation; recreate it if that insert was lost. */
async function ensureOrderRow(
  db: LtfDb,
  session: Stripe.Checkout.Session,
): Promise<OrderRow> {
  const columns = "id, access_token, payment_status, delivery_status";
  const existing = await db
    .from("ltf_orders")
    .select(columns)
    .eq("external_id", session.id)
    .maybeSingle();
  if (existing.error) {
    throw new Error(`ltf order lookup failed: ${existing.error.message}`);
  }
  if (existing.data) return existing.data;

  const visitorId = session.metadata?.visitor_id || null;
  const inserted = await db.from("ltf_orders").upsert(
    {
      external_id: session.id,
      visitor_id: await knownVisitor(db, visitorId),
      utm_source: session.metadata?.utm_source || null,
      utm_campaign: session.metadata?.utm_campaign || null,
      access_token: newAccessToken(),
    },
    { onConflict: "external_id", ignoreDuplicates: true },
  );
  if (inserted.error) {
    throw new Error(`ltf order recreate failed: ${inserted.error.message}`);
  }
  const row = await db
    .from("ltf_orders")
    .select(columns)
    .eq("external_id", session.id)
    .single();
  if (row.error)
    throw new Error(`ltf order reread failed: ${row.error.message}`);
  return row.data;
}

async function knownVisitor(db: LtfDb, visitorId: string | null) {
  if (!visitorId) return null;
  const { data, error } = await db
    .from("ltf_visitors")
    .select("visitor_id")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (error) throw new Error(`ltf visitor check failed: ${error.message}`);
  return data?.visitor_id ?? null;
}

/**
 * Claims the delivery (pending/failed, or a `sending` claim old enough to be a
 * crashed attempt), sends, and records the outcome. Two concurrent callers:
 * one claims, the other sees `in_progress`.
 */
async function deliverOnce(
  deps: LtfOrderDeps,
  orderId: string,
  email: string | null,
  accessToken: string,
): Promise<"sent" | "already_sent" | "in_progress" | "failed"> {
  const now = deps.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - STALE_SENDING_MS).toISOString();
  // Two single-condition claims, not one `.or()`: PostgREST rejects logical
  // filters on PATCH ("column ... does not exist"). Each is still atomic.
  const claimed =
    (await claimDelivery(deps.db, orderId, now, (q) =>
      q.in("delivery_status", ["pending", "failed"]),
    )) ||
    (await claimDelivery(deps.db, orderId, now, (q) =>
      q.eq("delivery_status", "sending").lt("updated_at", staleBefore),
    ));
  if (!claimed) {
    const current = await deps.db
      .from("ltf_orders")
      .select("delivery_status")
      .eq("id", orderId)
      .single();
    if (current.error) {
      throw new Error(`ltf delivery reread failed: ${current.error.message}`);
    }
    return current.data.delivery_status === "sent"
      ? "already_sent"
      : "in_progress";
  }

  const result = email
    ? await deps.sendEmail({
        to: email,
        name: null,
        downloadUrl: downloadUrlFor(deps.siteOrigin, accessToken),
      })
    : ({ ok: false, error: "checkout session has no email" } as const);

  const done = await deps.db
    .from("ltf_orders")
    .update({
      delivery_status: result.ok ? "sent" : "failed",
      delivery_error: result.ok ? null : result.error.slice(0, 500),
      updated_at: (deps.now?.() ?? new Date()).toISOString(),
    })
    .eq("id", orderId);
  if (done.error) {
    throw new Error(`ltf delivery record failed: ${done.error.message}`);
  }
  if (!result.ok) {
    console.error("ltf delivery email failed", {
      orderId,
      error: result.error,
    });
  }
  return result.ok ? "sent" : "failed";
}

type ClaimQuery = ReturnType<ReturnType<LtfDb["from"]>["update"]>;

async function claimDelivery(
  db: LtfDb,
  orderId: string,
  now: Date,
  condition: (query: ClaimQuery) => ClaimQuery,
): Promise<boolean> {
  const query = db
    .from("ltf_orders")
    .update({ delivery_status: "sending", updated_at: now.toISOString() })
    .eq("id", orderId)
    .eq("payment_status", "paid");
  const { data, error } = await condition(query as ClaimQuery).select("id");
  if (error) throw new Error(`ltf delivery claim failed: ${error.message}`);
  return Boolean(data?.length);
}

/* ------------------------------------------------------------------ */
/* Webhook events                                                      */
/* ------------------------------------------------------------------ */

export type WebhookOutcome = { handled: boolean; retry: boolean };

/**
 * `retry: true` asks the route to answer 500 so Stripe redelivers. Used only
 * when the buyer has paid and the email has not gone out yet: Stripe's retry
 * schedule (up to three days) then drives the email retries.
 */
export async function handleStripeEvent(
  deps: LtfOrderDeps,
  event: Stripe.Event,
): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const result = await fulfillCheckoutSession(deps, event.data.object.id);
      if (result.status === "not_ltf") return { handled: false, retry: false };
      const retry = result.status === "paid" && result.delivery === "failed";
      return { handled: true, retry };
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      if (!isLtfSession(session)) return { handled: false, retry: false };
      const next =
        event.type === "checkout.session.expired" ? "expired" : "failed";
      await updatePending(deps.db, session.id, next, deps.now);
      return { handled: true, retry: false };
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      if (intent.metadata?.[LTF_METADATA_KEY] !== LTF_METADATA_VALUE) {
        return { handled: false, retry: false };
      }
      await countPaymentFailure(deps.db, intent.metadata.visitor_id);
      return { handled: true, retry: false };
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const intentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null);
      if (!intentId) return { handled: false, retry: false };
      const handled = await recordRefund(deps.db, intentId, charge, deps.now);
      return { handled, retry: false };
    }
    default:
      return { handled: false, retry: false };
  }
}

async function updatePending(
  db: LtfDb,
  sessionId: string,
  next: "expired" | "failed",
  nowFn?: () => Date,
) {
  const { error } = await db
    .from("ltf_orders")
    .update({
      payment_status: next,
      checkout_url: null,
      updated_at: (nowFn?.() ?? new Date()).toISOString(),
    })
    .eq("external_id", sessionId)
    .eq("payment_status", "pending");
  if (error) throw new Error(`ltf ${next} update failed: ${error.message}`);
}

/**
 * ponytail: read-then-write counter; two simultaneous declines for one visitor
 * can count once. Reporting only, never gates access.
 */
async function countPaymentFailure(db: LtfDb, visitorId: string | undefined) {
  if (!visitorId) return;
  const row = await db
    .from("ltf_orders")
    .select("id, payment_failures")
    .eq("visitor_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (row.error)
    throw new Error(`ltf failure lookup failed: ${row.error.message}`);
  if (!row.data) return;
  const { error } = await db
    .from("ltf_orders")
    .update({ payment_failures: row.data.payment_failures + 1 })
    .eq("id", row.data.id);
  if (error) throw new Error(`ltf failure count failed: ${error.message}`);
}

/** A full refund revokes the download; a partial refund only records the amount. */
async function recordRefund(
  db: LtfDb,
  paymentIntentId: string,
  charge: Stripe.Charge,
  nowFn?: () => Date,
): Promise<boolean> {
  const now = (nowFn?.() ?? new Date()).toISOString();
  const full = charge.refunded || charge.amount_refunded >= charge.amount;
  const { data, error } = await db
    .from("ltf_orders")
    .update({
      refunded_cents: charge.amount_refunded,
      ...(full ? { payment_status: "refunded", refunded_at: now } : {}),
      updated_at: now,
    })
    .eq("payment_intent_id", paymentIntentId)
    .select("id");
  if (error) throw new Error(`ltf refund update failed: ${error.message}`);
  return Boolean(data?.length);
}

/* ------------------------------------------------------------------ */
/* Access + recovery                                                   */
/* ------------------------------------------------------------------ */

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** The paid, unrefunded Stripe order a download token belongs to, or null. */
export async function findDownloadableOrder(
  db: LtfDb,
  token: string | null,
): Promise<{ id: string; download_count: number } | null> {
  if (!token || !TOKEN.test(token)) return null;
  const { data, error } = await db
    .from("ltf_orders")
    .select("id, download_count")
    .eq("access_token", token)
    .eq("payment_status", "paid")
    .maybeSingle();
  if (error) throw new Error(`ltf download lookup failed: ${error.message}`);
  return data;
}

/** ponytail: read-then-write counter, reporting only. */
export async function countDownload(
  db: LtfDb,
  order: { id: string; download_count: number },
  nowFn?: () => Date,
) {
  const { error } = await db
    .from("ltf_orders")
    .update({
      download_count: order.download_count + 1,
      last_downloaded_at: (nowFn?.() ?? new Date()).toISOString(),
    })
    .eq("id", order.id);
  if (error) throw new Error(`ltf download count failed: ${error.message}`);
}

/**
 * Re-sends the download link to every paid order on this email. Says nothing
 * to the caller about whether the email bought, so the form cannot be used to
 * test addresses; the route always shows the same message.
 */
export async function resendAccess(
  deps: Pick<LtfOrderDeps, "db" | "sendEmail" | "siteOrigin">,
  email: string,
): Promise<{ sent: number }> {
  const { data, error } = await deps.db
    .from("ltf_orders")
    .select("access_token, email")
    .eq("payment_status", "paid")
    .eq("email", email.trim().toLowerCase())
    .limit(3);
  if (error) throw new Error(`ltf recovery lookup failed: ${error.message}`);
  let sent = 0;
  for (const order of data ?? []) {
    if (!order.email) continue;
    const result = await deps.sendEmail({
      to: order.email,
      name: null,
      downloadUrl: downloadUrlFor(deps.siteOrigin, order.access_token),
    });
    if (result.ok) sent += 1;
    else console.error("ltf recovery email failed", { error: result.error });
  }
  return { sent };
}
