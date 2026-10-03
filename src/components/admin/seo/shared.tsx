import {
  AdminDeltaChip,
  adminCardClass,
  adminPanelClass,
} from "@/components/admin/AdminUi";
import { type Mover } from "@/lib/services/seo-command-center";

export const SITE = "https://www.vendingpreneurs.com";
export const C = {
  accent: "var(--ui-accent)",
  ok: "var(--ui-ok)",
  warn: "var(--ui-warn)",
  idle: "var(--ui-idle)",
  bad: "var(--ui-bad)",
};

export const n = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined
    ? "n/a"
    : v.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });

export function Delta({
  now,
  before,
  lowerIsBetter = false,
}: {
  now: number | null;
  before: number | null;
  lowerIsBetter?: boolean;
}) {
  if (now === null || before === null || before === 0) return null;
  const change = ((now - before) / before) * 100;
  const good = lowerIsBetter ? change < 0 : change > 0;
  const tone = Math.abs(change) < 1 ? "neutral" : good ? "up" : "down";
  return (
    <AdminDeltaChip
      tone={tone}
    >{`${change > 0 ? "+" : ""}${n(change, 0)}%`}</AdminDeltaChip>
  );
}

/** Position moves in places: fewer is better, so a drop is good news. */
export function PointsDelta({
  now,
  before,
}: {
  now: number | null;
  before: number | null;
}) {
  if (now === null || before === null) return null;
  const better = before - now;
  const tone = Math.abs(better) < 0.1 ? "neutral" : better > 0 ? "up" : "down";
  return (
    <AdminDeltaChip
      tone={tone}
    >{`${better > 0 ? "+" : ""}${n(better, 1)} places`}</AdminDeltaChip>
  );
}

export function SeoMissing() {
  return (
    <div className={`${adminCardClass} text-ui-text-muted text-sm`}>
      <p className="text-ui-text font-semibold">
        The SEO tables are not created yet.
      </p>
      <p className="mt-2">
        Paste the SEO block from{" "}
        <code>supabase/migrations/APPLY-IN-SQL-EDITOR.md</code> into the
        Supabase SQL editor, then run the backfill once:{" "}
        <code>/api/admin/search-console-sync/run?days=500</code> and{" "}
        <code>/api/admin/metricool-sync/run?days=400</code>.
      </p>
    </div>
  );
}

export function MoverTable({
  title,
  rows,
  bare = false,
}: {
  title: string;
  rows: Mover[];
  /** Inside another panel: no frame, no visible title. */
  bare?: boolean;
}) {
  return (
    <div className={bare ? "" : adminPanelClass}>
      {bare ? null : (
        <h3 className="text-ui-text border-ui-line border-b px-4 py-2.5 text-sm font-semibold">
          {title}
        </h3>
      )}
      {rows.length === 0 ? (
        <p className="text-ui-text-subtle px-4 py-3 text-xs">
          Nothing moved by 20+ impressions.
        </p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-ui-text-subtle text-left text-xs">
              <th className="w-3/5 px-4 pt-2 pb-1 font-medium">
                <span className="sr-only">{title}</span>
              </th>
              <th className="px-2 pt-2 pb-1 text-right font-medium">
                Impressions
              </th>
              <th className="px-4 pt-2 pb-1 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {rows.map((m) => (
              <tr key={m.key}>
                <td
                  className="text-ui-text w-3/5 max-w-0 truncate px-4 py-2"
                  title={m.key}
                >
                  {m.key}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {n(m.impressions)}
                </td>
                <td className="px-4 py-2 text-right">
                  <AdminDeltaChip
                    tone={
                      m.change > 0 ? "up" : m.change < 0 ? "down" : "neutral"
                    }
                  >
                    {`${m.change > 0 ? "+" : ""}${n(m.change)}`}
                  </AdminDeltaChip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export const label = (s: string) => s.replace(/_/g, " ");
