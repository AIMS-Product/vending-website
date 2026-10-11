import Image from "next/image";
import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import { formatCount, formatUsd } from "@/lib/admin/format-number";
import type {
  GoogleAdsCreative,
  GoogleAdsRow,
} from "@/lib/services/google-ads-dashboard";

const COLUMNS = [
  "Spend",
  "Clicks",
  "Leads",
  "Booked calls",
  "Cost per booked call",
  "Won",
  "Won value",
] as const;

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="text-ui-text py-2.5 pr-3 text-right tabular-nums">
      {children}
    </td>
  );
}

export function GoogleAdsTotals({ totals }: { totals: GoogleAdsRow }) {
  const items = [
    ["Spend", formatUsd(totals.spend)],
    ["Leads", formatCount(totals.leads)],
    ["Booked calls", formatCount(totals.booked)],
    [
      "Cost per booked call",
      totals.costPerBooked === null ? "–" : formatUsd(totals.costPerBooked),
    ],
    ["Won", formatCount(totals.won)],
    ["Won value", formatUsd(totals.wonValue)],
  ];
  return (
    <section
      className={`${adminCardClass} grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6`}
      aria-label="Google Ads totals"
    >
      {items.map(([label, value]) => (
        <div key={label}>
          <p className={adminEyebrowClass}>{label}</p>
          <p className="text-ui-text mt-1 text-xl font-semibold tabular-nums">
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}

export function GoogleAdsTable({
  title,
  firstColumn,
  rows,
  empty,
}: {
  title: string;
  firstColumn: string;
  rows: GoogleAdsRow[];
  empty: string;
}) {
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">{firstColumn}</th>
                {COLUMNS.map((c) => (
                  <th key={c} className="py-2 pr-3 text-right font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="text-ui-text max-w-[22rem] truncate py-2.5 pr-3 font-medium">
                    {row.label}
                  </td>
                  <Cell>{formatUsd(row.spend)}</Cell>
                  <Cell>{formatCount(row.clicks)}</Cell>
                  <Cell>{formatCount(row.leads)}</Cell>
                  <Cell>{formatCount(row.booked)}</Cell>
                  <Cell>
                    {row.costPerBooked === null
                      ? "–"
                      : formatUsd(row.costPerBooked)}
                  </Cell>
                  <Cell>{formatCount(row.won)}</Cell>
                  <Cell>{formatUsd(row.wonValue)}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function GoogleAdsCreatives({
  creatives,
}: {
  creatives: GoogleAdsCreative[];
}) {
  return (
    <section className={adminCardClass} aria-label="Top creatives by spend">
      <h2 className={adminEyebrowClass}>Top creatives by spend</h2>
      {creatives.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No creative rows yet. They arrive with the daily Google Ads script.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {creatives.map((c) => (
            <li
              key={c.assetId}
              className="border-ui-line rounded-ui flex gap-3 border p-3"
            >
              {c.previewUrl ? (
                <Image
                  src={c.previewUrl}
                  alt=""
                  width={96}
                  height={64}
                  // Ad assets live on Google hosts not in next.config.
                  unoptimized
                  className="rounded-ui h-16 w-24 shrink-0 object-cover"
                />
              ) : null}
              <div className="min-w-0 text-[0.8125rem]">
                <p className="text-ui-text line-clamp-2 font-medium">
                  {c.text ?? c.assetType ?? c.assetId}
                </p>
                <p className="text-ui-text-subtle mt-1 tabular-nums">
                  {formatUsd(c.cost)} · {formatCount(c.clicks)} clicks ·{" "}
                  {formatCount(c.conversions)} conv.
                  {c.performanceLabel ? ` · ${c.performanceLabel}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
