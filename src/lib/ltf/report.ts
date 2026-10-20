import "server-only";
import type { LtfDb, LtfVariant } from "@/lib/ltf/assignment";

/** Stripe's US card rate, used only where GHL does not report the fee. */
const ESTIMATED_FEE = { pct: 0.029, fixedCents: 30 };
/** Below this many buyers per version the report refuses to name a winner. */
export const MIN_BUYERS_PER_VERSION = 30;

export type LtfVersionReport = {
  variant: LtfVariant;
  visitors: number;
  offerViews: number;
  checkoutStarts: number;
  buyers: number;
  refunds: number;
  grossCents: number;
  feeCents: number;
  feeEstimated: boolean;
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

export async function loadLtfReport(db: LtfDb): Promise<LtfVersionReport[]> {
  const { data, error } = await db
    .from("ltf_report")
    .select("*")
    .order("variant");
  if (error) throw new Error(`ltf report failed: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    if (row.variant !== "a" && row.variant !== "b") return [];
    const buyers = n(row.buyers);
    const grossCents = n(row.gross_cents);
    const missingFee = n(row.orders_missing_fee);
    const estimated = Math.round(
      missingFee * ESTIMATED_FEE.fixedCents +
        rate(missingFee, buyers) * grossCents * ESTIMATED_FEE.pct,
    );
    const feeCents = n(row.fee_cents) + estimated;
    const refundedCents = n(row.refunded_cents);
    const netCents = grossCents - feeCents - refundedCents;
    const visitors = n(row.visitors);
    return [
      {
        variant: row.variant,
        visitors,
        offerViews: n(row.offer_views),
        checkoutStarts: n(row.checkout_starts),
        buyers,
        refunds: n(row.refunds),
        grossCents,
        feeCents,
        feeEstimated: missingFee > 0,
        refundedCents,
        netCents,
        paymentFailures: n(row.payment_failures),
        deliveryFailures: n(row.delivery_failures),
        buyersDownloaded: n(row.buyers_downloaded),
        conversion: rate(buyers, visitors),
        netPerVisitorCents: rate(netCents, visitors),
      },
    ];
  });
}

/**
 * Two-sided two-proportion z-test on buyers / visitors. Returns the p-value,
 * or null when either version is too small to say anything.
 */
export function conversionPValue(
  a: { buyers: number; visitors: number },
  b: { buyers: number; visitors: number },
): number | null {
  if (
    a.buyers < MIN_BUYERS_PER_VERSION ||
    b.buyers < MIN_BUYERS_PER_VERSION ||
    !a.visitors ||
    !b.visitors
  ) {
    return null;
  }
  const pa = a.buyers / a.visitors;
  const pb = b.buyers / b.visitors;
  const pooled = (a.buyers + b.buyers) / (a.visitors + b.visitors);
  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / a.visitors + 1 / b.visitors),
  );
  if (se === 0) return 1;
  const z = Math.abs(pa - pb) / se;
  return 2 * (1 - normalCdf(z));
}

/** Abramowitz-Stegun 7.1.26 erf approximation; error < 1.5e-7. */
function normalCdf(z: number): number {
  const x = z / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return 0.5 * (1 + (1 - poly * Math.exp(-x * x)));
}
