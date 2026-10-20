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
    conversion: rate(buyers, visitors),
    netPerVisitorCents: rate(netCents, visitors),
  };
}
