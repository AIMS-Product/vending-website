import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";
import { isGuideSwapLive } from "@/lib/ltf/assignment";
import { loadLtfBuyers, loadLtfReport, type LtfReport } from "@/lib/ltf/report";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "$5 Playbook sales",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const num = (value: number) => value.toLocaleString();

const ROWS: {
  label: string;
  value: (r: LtfReport) => string;
  note?: string;
}[] = [
  {
    label: "Unique visitors",
    value: (r) => num(r.visitors),
    note: "Bots excluded.",
  },
  { label: "Checkout starts", value: (r) => num(r.checkoutStarts) },
  { label: "Paid buyers", value: (r) => num(r.buyers) },
  { label: "Conversion (buyers ÷ visitors)", value: (r) => pct(r.conversion) },
  {
    label: "Checkout start → paid",
    value: (r) => pct(r.checkoutStarts ? r.buyers / r.checkoutStarts : 0),
  },
  { label: "Gross revenue", value: (r) => usd(r.grossCents) },
  { label: "Stripe fees", value: (r) => usd(r.feeCents) },
  {
    label: "Refunds",
    value: (r) => `${num(r.refunds)} · ${usd(r.refundedCents)}`,
  },
  { label: "Net revenue", value: (r) => usd(r.netCents) },
  { label: "Net revenue per visitor", value: (r) => usd(r.netPerVisitorCents) },
  { label: "Declined payments", value: (r) => num(r.paymentFailures) },
  {
    label: "Paid but email not sent",
    value: (r) => num(r.deliveryFailures),
    note: "Should be 0. Stripe retries the webhook, which retries the email.",
  },
  { label: "Buyers who downloaded", value: (r) => num(r.buyersDownloaded) },
];

export default async function PlaybookSalesPage() {
  const db = createAdminClient();
  const [{ user, role }, report, buyers] = await Promise.all([
    requireAdmin(),
    loadLtfReport(db),
    loadLtfBuyers(db),
  ]);

  return (
    <AdminShell
      activeSection="analytics"
      eyebrow="Funnels"
      title="$5 First Location Playbook"
      description="Sold through Stripe Checkout on /playbook/guide. All-time totals."
      userEmail={user.email}
      userRole={role}
    >
      <p className={`${adminPanelClass} text-ui-text mb-6 p-4 text-sm`}>
        <strong>
          {isGuideSwapLive()
            ? "Swapped in: /playbook sells this offer."
            : "Unlisted: live at /playbook-stripe, /playbook still sells the course."}
        </strong>
      </p>
      <div className={`${adminPanelClass} overflow-x-auto`}>
        <table className="text-ui-text w-full text-sm">
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
                <td className="p-3 text-right tabular-nums">
                  {row.value(report)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-ui-text mt-10 mb-3 text-base font-semibold">
        Buyers ({buyers.length})
      </h2>
      <div className={`${adminPanelClass} overflow-x-auto`}>
        <table className="text-ui-text w-full text-sm">
          <thead>
            <tr className="border-ui-line border-b text-left">
              {[
                "Paid",
                "Name",
                "Email",
                "Phone",
                "Source",
                "Downloaded",
                "Emailed",
              ].map((h) => (
                <th key={h} className="p-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buyers.length === 0 ? (
              <tr>
                <td className="text-ui-text-muted p-3" colSpan={7}>
                  No buyers yet.
                </td>
              </tr>
            ) : (
              buyers.map((b, i) => (
                <tr
                  key={`${b.email}-${i}`}
                  className="border-ui-line border-b last:border-0"
                >
                  <td className="p-3 whitespace-nowrap tabular-nums">
                    {b.paidAt
                      ? new Date(b.paidAt).toLocaleString("en-US", {
                          timeZone: "America/Los_Angeles",
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : ""}
                    {b.refunded ? " (refunded)" : ""}
                  </td>
                  <td className="p-3">{b.name}</td>
                  <td className="p-3">{b.email}</td>
                  <td className="p-3 whitespace-nowrap">{b.phone}</td>
                  <td className="p-3">{b.source}</td>
                  <td className="p-3 tabular-nums">{b.downloads}</td>
                  <td className="p-3">{b.emailed ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
