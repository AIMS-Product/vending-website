import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";
import { isLtfTestOpen } from "@/lib/ltf/assignment";
import {
  MIN_BUYERS_PER_VERSION,
  conversionPValue,
  loadLtfReport,
  type LtfVersionReport,
} from "@/lib/ltf/report";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "LTF $5 PDF test",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

const LABEL = {
  a: "A · GHL checkout embed",
  b: "B · Stripe Checkout",
} as const;

const ROWS: {
  label: string;
  value: (r: LtfVersionReport) => string;
  note?: string;
}[] = [
  {
    label: "Unique visitors",
    value: (r) => r.visitors.toLocaleString(),
    note: "Bots excluded.",
  },
  { label: "Paid buyers", value: (r) => r.buyers.toLocaleString() },
  {
    label: "Conversion (buyers ÷ visitors)",
    value: (r) => pct(r.conversion),
    note: "Primary metric.",
  },
  { label: "Net revenue per visitor", value: (r) => usd(r.netPerVisitorCents) },
  { label: "Checkout starts", value: (r) => r.checkoutStarts.toLocaleString() },
  {
    label: "Checkout start → paid",
    value: (r) => pct(r.checkoutStarts ? r.buyers / r.checkoutStarts : 0),
  },
  { label: "Gross revenue", value: (r) => usd(r.grossCents) },
  {
    label: "Fees",
    value: (r) => `${usd(r.feeCents)}${r.feeEstimated ? " (est.)" : ""}`,
    note: "GHL orders estimated at 2.9% + 30¢.",
  },
  { label: "Refunds", value: (r) => `${r.refunds} · ${usd(r.refundedCents)}` },
  { label: "Net revenue", value: (r) => usd(r.netCents) },
  {
    label: "Payment failures",
    value: (r) =>
      r.variant === "b" ? r.paymentFailures.toLocaleString() : "n/a",
    note: "Stripe reports declines; GHL does not.",
  },
  {
    label: "Delivery failures (paid, email not sent)",
    value: (r) =>
      r.variant === "b" ? r.deliveryFailures.toLocaleString() : "n/a",
    note: "A is delivered by GHL.",
  },
  {
    label: "Buyers who downloaded",
    value: (r) =>
      r.variant === "b" ? r.buyersDownloaded.toLocaleString() : "n/a",
  },
];

export default async function LtfTestReportPage() {
  const [{ user, role }, report] = await Promise.all([
    requireAdmin(),
    loadLtfReport(createAdminClient()),
  ]);
  const a = report.find((r) => r.variant === "a");
  const b = report.find((r) => r.variant === "b");
  const p = a && b ? conversionPValue(a, b) : null;
  const verdict =
    p === null
      ? `Too early to call. Wait for at least ${MIN_BUYERS_PER_VERSION} buyers in each version.`
      : p < 0.05
        ? `Significant difference (p = ${p.toFixed(3)}). ${a!.conversion > b!.conversion ? "A" : "B"} converts better.`
        : `No significant difference yet (p = ${p.toFixed(3)}).`;

  return (
    <AdminShell
      activeSection="analytics"
      eyebrow="Experiments"
      title="LTF $5 PDF: GHL vs Stripe"
      description="Same offer page, same $5 PDF. Only the checkout differs. Visitors keep their version on return visits."
      userEmail={user.email}
      userRole={role}
    >
      <p className={`${adminPanelClass} text-ui-text mb-6 p-4 text-sm`}>
        <strong>Test is {isLtfTestOpen() ? "ON" : "OFF"}.</strong> {verdict}
      </p>
      <div className={`${adminPanelClass} overflow-x-auto`}>
        <table className="text-ui-text w-full text-sm">
          <thead>
            <tr className="border-ui-line border-b text-left">
              <th className="p-3 font-semibold">Metric</th>
              {report.map((r) => (
                <th key={r.variant} className="p-3 text-right font-semibold">
                  {LABEL[r.variant]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.label}
                className="border-ui-line border-b last:border-0"
              >
                <td className="p-3">
                  {row.label}
                  {row.note ? (
                    <span className="text-ui-text-muted block text-xs">
                      {row.note}
                    </span>
                  ) : null}
                </td>
                {report.map((r) => (
                  <td key={r.variant} className="p-3 text-right tabular-nums">
                    {row.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
