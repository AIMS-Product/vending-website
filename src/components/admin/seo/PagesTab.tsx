import Link from "next/link";
import {
  adminPanelClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { type PageRow } from "@/lib/services/seo-command-center";
import { n, Delta } from "./shared";

export function SeoPagesTab({
  pages,
  asOf,
}: {
  pages: PageRow[];
  asOf: string | null;
}) {
  return (
    <section className={adminPanelClass}>
      <p className="text-ui-text-subtle px-4 pt-3 text-xs">
        Every URL Google showed in the last 16 weeks, through {asOf ?? "n/a"}.
        Trend = weekly impressions.
      </p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-sm">
          <thead className={adminStickyHeadClass}>
            <tr className="text-ui-text-subtle text-left text-xs">
              <th className="px-4 py-2">Page</th>
              <th className="px-2 py-2 text-right">Impressions</th>
              <th className="px-2 py-2 text-right">Clicks</th>
              <th className="px-2 py-2 text-right">CTR</th>
              <th className="px-2 py-2 text-right">Position</th>
              <th className="px-2 py-2">16 weeks</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {pages.map((p) => (
              <tr key={p.url}>
                <td
                  className="text-ui-text max-w-[22rem] truncate px-4 py-2"
                  title={p.url}
                >
                  {p.path}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(p.current.impressions)}{" "}
                  <Delta
                    now={p.current.impressions}
                    before={p.prior.impressions}
                  />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(p.current.clicks)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {p.current.ctrPct === null
                    ? "n/a"
                    : `${n(p.current.ctrPct, 1)}%`}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(p.current.position, 1)}
                </td>
                <td className="px-2 py-2">
                  <Bars values={p.weekly} />
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {p.cmsPageId ? (
                    <Link
                      className="text-ui-accent text-xs"
                      href={`/admin/pages/${p.cmsPageId}`}
                    >
                      Edit
                    </Link>
                  ) : null}{" "}
                  <a
                    className="text-ui-text-muted inline-flex items-center"
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${p.path} on the site`}
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <svg
      viewBox={`0 0 ${values.length * 5} 20`}
      className="h-5 w-20"
      aria-hidden="true"
    >
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * 5}
          y={20 - (v / max) * 20}
          width={4}
          height={(v / max) * 20}
          fill="var(--ui-accent)"
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
