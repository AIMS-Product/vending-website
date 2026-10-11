import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import { formatCount, formatUsd } from "@/lib/admin/format-number";
import {
  NO_CAMPAIGN_ID,
  type GoogleAdsAd,
  type GoogleAdsRow,
} from "@/lib/services/google-ads-dashboard";
import { PRE_TRACKING } from "@/lib/services/google-ads-insights";

/** Buckets that are not a real keyword or campaign, in words. */
const ROW_LABELS: Record<string, string> = {
  [PRE_TRACKING]: "Keyword unknown (lead came before keyword tracking)",
  [NO_CAMPAIGN_ID]: "No Google campaign id (other link tags)",
};

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

export function GoogleAdsTable({
  title,
  firstColumn,
  rows,
  empty,
  note,
}: {
  title: string;
  firstColumn: string;
  rows: GoogleAdsRow[];
  empty: string;
  /** A caveat a media buyer must read before acting on the table. */
  note?: string | null;
}) {
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      {note ? (
        <p className="text-ui-text-muted mt-2 max-w-3xl text-[0.8125rem]">
          {note}
        </p>
      ) : null}
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
                    {ROW_LABELS[row.key] ?? row.label}
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

function adStatus(
  status: string,
  approval: string | null,
): { label: string; tone: "ok" | "warn" | "bad" | "idle" } {
  if (status === "PAUSED") return { label: "Paused", tone: "idle" };
  if (status === "REMOVED") return { label: "Removed", tone: "idle" };
  if (approval === "DISAPPROVED") return { label: "Disapproved", tone: "bad" };
  if (approval === "APPROVED_LIMITED")
    return { label: "Limited", tone: "warn" };
  if (approval === "APPROVED") return { label: "Approved", tone: "ok" };
  return { label: "In review", tone: "warn" };
}

function landingPath(url: string | null): string {
  if (!url) return "–";
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function GoogleAdsAds({ ads }: { ads: GoogleAdsAd[] }) {
  return (
    <section className={adminCardClass} aria-label="Ads by spend">
      <h2 className={adminEyebrowClass}>Ads by spend</h2>
      <p className="text-ui-text-muted mt-2 max-w-3xl text-[0.8125rem]">
        Each ad&rsquo;s spend in this range, with its status as of the last
        sync. Booked calls are not split by ad: a lead carries its ad group, not
        the ad.
      </p>
      {ads.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No ad spend in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">Ad</th>
                <th className="py-2 pr-3 font-semibold">Landing page</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 text-right font-semibold">Spend</th>
                <th className="py-2 pr-3 text-right font-semibold">Clicks</th>
                <th className="py-2 pr-3 text-right font-semibold">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {ads.map((ad) => {
                const badge = adStatus(ad.status, ad.approval);
                return (
                  <tr key={ad.adId}>
                    <td className="max-w-[28rem] py-2.5 pr-3">
                      <p className="text-ui-text truncate font-medium">
                        {ad.headlines.slice(0, 3).join(" | ") || ad.adId}
                      </p>
                      <p className="text-ui-text-subtle truncate">
                        {ad.campaign}
                        {ad.adGroup ? ` › ${ad.adGroup}` : ""}
                      </p>
                    </td>
                    <td className="text-ui-text py-2.5 pr-3">
                      {landingPath(ad.landing)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <AdminStatusBadge
                        status={badge.label}
                        label={badge.label}
                        tone={badge.tone}
                      />
                    </td>
                    <Cell>{formatUsd(ad.spend)}</Cell>
                    <Cell>{formatCount(ad.clicks)}</Cell>
                    <Cell>
                      {ad.impressions > 0
                        ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%`
                        : "–"}
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
