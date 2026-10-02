import Link from "next/link";
import {
  adminCardClass,
  adminPanelClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { SeoTrendChart } from "@/components/admin/SeoTrendChart";
import { type SeoSocial } from "@/lib/services/seo-command-center";
import { C, n } from "./shared";

const NETWORK_NAMES: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "X",
  youtube: "YouTube",
};

/**
 * Each value as a share of the series' own average (average = 100). Days
 * before a series' first value are gaps, not zeros: Search Console history
 * starts later than Metricool's, and a flat zero would read as no searches.
 */
function indexed(values: number[]): Array<number | null> {
  const first = values.findIndex((v) => v > 0);
  const nonZero = values.filter((v) => v > 0);
  const mean = nonZero.reduce((s, v) => s + v, 0) / (nonZero.length || 1);
  return values.map((v, i) =>
    first === -1 || i < first ? null : mean ? Math.round((v / mean) * 100) : 0,
  );
}

export function SeoSocialTab({
  data,
  allBrands,
}: {
  data: SeoSocial;
  allBrands: boolean;
}) {
  const days = data.visibility.map((v) => v.day);
  return (
    <div className="space-y-5">
      <nav className="flex gap-2 text-xs" aria-label="Brands">
        <Link
          href="/admin/seo?tab=social&brands=vp"
          className={`rounded-ui border px-2 py-1 ${!allBrands ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
        >
          Vendingpreneurs accounts only
        </Link>
        <Link
          href="/admin/seo?tab=social"
          className={`rounded-ui border px-2 py-1 ${allBrands ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
        >
          All brands, incl. Mike
        </Link>
      </nav>
      <section className={adminPanelClass}>
        <table className="w-full text-sm">
          <thead className={adminStickyHeadClass}>
            <tr className="text-ui-text-subtle text-left text-xs">
              <th className="px-4 py-2">Network</th>
              <th className="px-2 py-2 text-right">Followers</th>
              <th className="px-2 py-2 text-right">28-day change</th>
              <th className="px-2 py-2 text-right">
                Impressions / views, 28 days
              </th>
              <th className="px-2 py-2 text-right">Interactions</th>
              <th className="px-4 py-2 text-right">Posts</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {data.networks.map((s) => (
              <tr key={s.network}>
                <td className="text-ui-text px-4 py-2">
                  <span className="flex items-center gap-2">
                    <ChannelLogo
                      label={NETWORK_NAMES[s.network] ?? s.network}
                    />
                    {NETWORK_NAMES[s.network] ?? s.network}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(s.followers)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.followersChange === null
                    ? "n/a"
                    : `${s.followersChange > 0 ? "+" : ""}${n(s.followersChange)}`}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(s.impressions28)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(s.interactions28)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {n(s.posts28)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-ui-text-subtle px-4 py-2 text-xs">
          Metricool account series through {data.asOf ?? "n/a"}. Follower
          history starts about 2026-07-27 in Metricool; post impressions and
          interactions go back a year. A network no brand has connected shows no
          row. YouTube counts views. Facebook is counted once: the two brands
          share one page.
        </p>
      </section>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Social impressions and views
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Every connected network together, YouTube views included. Google
          search impressions are on the Overview tab: at a thousandth of this
          scale they would be a flat line here.
        </p>
        <SeoTrendChart
          ariaLabel="Social impressions and views"
          bars
          days={days}
          series={[
            {
              label: "Social impressions and views",
              color: C.accent,
              values: data.visibility.map((v) => v.social),
            },
          ]}
        />
      </section>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Does social lift branded search?
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Both as an index where each series&apos; own average = 100, so a
          1,000-impression series and a 1,000,000-impression series share one
          axis. Read the shapes together, not as cause.
        </p>
        <SeoTrendChart
          ariaLabel="Branded search impressions against social impressions per day, indexed"
          days={days}
          series={[
            {
              label: "Branded Google impressions (index)",
              color: C.accent,
              values: indexed(data.visibility.map((v) => v.brandSearch)),
            },
            {
              label: "Social impressions (index)",
              color: "var(--ui-chart-7)",
              values: indexed(data.visibility.map((v) => v.social)),
            },
          ]}
        />
      </section>
    </div>
  );
}
