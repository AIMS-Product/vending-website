import "server-only";
import type { LtfDb } from "@/lib/ltf/assignment";

export type LtfReport = {
  visitors: number;
  offerViews: number;
  checkoutStarts: number;
  buyers: number;
  refunds: number;
  grossCents: number;
  feeCents: number;
  refundedCents: number;
  netCents: number;
  paymentFailures: number;
  deliveryFailures: number;
  buyersDownloaded: number;
  /** Paid $0 orders (100% off promo). Not buyers. */
  freeOrders: number;
  conversion: number;
  netPerVisitorCents: number;
};

const n = (value: number | null | undefined) => Number(value ?? 0);
const rate = (num: number, den: number) => (den > 0 ? num / den : 0);

/** The $5 playbook funnel in one row (view `ltf_report`, bots excluded). */
export async function loadLtfReport(db: LtfDb): Promise<LtfReport> {
  const { data, error } = await db.from("ltf_report").select("*").single();
  if (error) throw new Error(`ltf report failed: ${error.message}`);
  const visitors = n(data.visitors);
  const buyers = n(data.buyers);
  const grossCents = n(data.gross_cents);
  const feeCents = n(data.fee_cents);
  const refundedCents = n(data.refunded_cents);
  const netCents = grossCents - feeCents - refundedCents;
  return {
    visitors,
    offerViews: n(data.offer_views),
    checkoutStarts: n(data.checkout_starts),
    buyers,
    refunds: n(data.refunds),
    grossCents,
    feeCents,
    refundedCents,
    netCents,
    paymentFailures: n(data.payment_failures),
    deliveryFailures: n(data.delivery_failures),
    buyersDownloaded: n(data.buyers_downloaded),
    freeOrders: n(data.free_orders),
    conversion: rate(buyers, visitors),
    netPerVisitorCents: rate(netCents, visitors),
  };
}

export type LtfBuyer = {
  paidAt: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  downloads: number;
  emailed: boolean;
  refunded: boolean;
};

/** Most recent buyers first, for the sales team (call them, check webinar attendance). */
export async function loadLtfBuyers(
  db: LtfDb,
  limit = 500,
): Promise<LtfBuyer[]> {
  const { data, error } = await db
    .from("ltf_orders")
    .select(
      "paid_at, name, email, phone, utm_source, download_count, delivery_status, payment_status",
    )
    .in("payment_status", ["paid", "refunded"])
    .order("paid_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`ltf buyers failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    paidAt: row.paid_at,
    name: row.name,
    email: row.email,
    phone: row.phone,
    source: row.utm_source,
    downloads: row.download_count,
    emailed: row.delivery_status === "sent",
    refunded: row.payment_status === "refunded",
  }));
}
