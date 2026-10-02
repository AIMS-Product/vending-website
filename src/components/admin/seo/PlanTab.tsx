import Link from "next/link";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminPanelClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { SeoTrendChart } from "@/components/admin/SeoTrendChart";
import { type ContentPlan } from "@/lib/services/seo-plan-data";
import { updatePieceStatus } from "@/app/admin/seo/actions";
import { SITE, C, n, label } from "./shared";

const PIECE_STATUSES = [
  "planned",
  "drafting",
  "in_review",
  "verify_needed",
  "scheduled",
  "published",
  "refreshing",
] as const;

export function SeoPlanTab({
  plan,
  canEdit,
}: {
  plan: ContentPlan;
  canEdit: boolean;
}) {
  const live = plan.pieces.filter((p) => p.live).length;
  const p1 = plan.pieces.filter(
    (p) => p.priority === "P1" && !p.notes?.startsWith("Same page"),
  );
  return (
    <div className="space-y-5">
      <AdminMetricStrip columns={4}>
        <AdminMetricPanel
          label="Live pieces"
          value={`${live} / ${plan.hubs.reduce((s, h) => s + h.total, 0)}`}
          caption="published /resources pages in the plan"
        />
        <AdminMetricPanel
          label="P1 live"
          value={`${p1.filter((p) => p.live).length} / ${p1.length}`}
          caption="weeks 1-10"
        />
        <AdminMetricPanel
          label="Drafts waiting on VERIFY"
          value={n(
            plan.pieces.filter((p) => p.verify_flags > 0 && !p.live).length,
          )}
          caption={`${n(plan.pieces.reduce((s, p) => s + (p.live ? 0 : p.verify_flags), 0))} flags to clear`}
        />
        <AdminMetricPanel
          label="Live pages under 2 live inbound links"
          value={n(
            plan.pieces.filter((p) => p.live && p.liveInbound < 2).length,
          )}
          caption="interlinking health"
        />
      </AdminMetricStrip>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${adminCardClass} lg:col-span-2`}>
          <h2 className="text-ui-text text-sm font-semibold">
            Production vs plan
          </h2>
          <BurnUp rows={plan.burnUp} />
        </section>
        <section className={adminCardClass}>
          <h2 className="text-ui-text text-sm font-semibold">Hub coverage</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {plan.hubs.map((h) => (
              <li key={h.hub} className="flex items-center gap-2">
                <span className="text-ui-text-muted w-14">Hub {h.hub}</span>
                <span className="bg-ui-line relative h-2 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-ui-ok absolute inset-y-0 left-0"
                    style={{
                      width: `${h.total ? (h.live / h.total) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="w-12 text-right tabular-nums">
                  {h.live}/{h.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={adminStickyHeadClass}>
              <tr className="text-ui-text-subtle text-left text-xs">
                <th className="px-4 py-2">Piece</th>
                <th className="px-2 py-2">Primary keyword</th>
                <th className="px-2 py-2">Week</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Live links in</th>
                <th className="px-4 py-2">Draft</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {plan.pieces.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-1.5">
                    <span className="text-ui-text-subtle mr-2 text-xs tabular-nums">
                      {p.id}
                    </span>
                    {p.live ? (
                      <a
                        className="text-ui-accent"
                        href={`${SITE}/resources/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.title}
                      </a>
                    ) : (
                      <span className="text-ui-text">{p.title}</span>
                    )}
                    {p.cmsPageId ? (
                      <Link
                        className="text-ui-text-muted ml-2 text-xs"
                        href={`/admin/pages/${p.cmsPageId}`}
                      >
                        Edit
                      </Link>
                    ) : null}
                  </td>
                  <td className="text-ui-text-muted px-2 py-1.5 text-xs">
                    {p.primary_keyword}
                  </td>
                  <td className="px-2 py-1.5 text-xs tabular-nums">
                    {p.priority} {p.sequence_week ? `w${p.sequence_week}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    {p.live ? (
                      <span className="text-ui-ok font-medium">
                        live {p.liveSince}
                      </span>
                    ) : canEdit ? (
                      <form
                        action={updatePieceStatus}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <select
                          name="status"
                          defaultValue={p.status}
                          aria-label={`Status of ${p.id}`}
                          className="rounded-ui border-ui-line border bg-transparent px-1 py-0.5 text-xs"
                        >
                          {PIECE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="text-ui-accent text-xs"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      label(p.status)
                    )}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right text-xs tabular-nums ${p.live && p.liveInbound < 2 ? "text-ui-bad font-medium" : ""}`}
                  >
                    {p.liveInbound} / {p.plannedInbound}
                  </td>
                  <td className="text-ui-text-subtle px-4 py-1.5 text-xs">
                    {p.draft_file
                      ? `${p.draft_file}${p.verify_flags ? ` (${p.verify_flags} VERIFY)` : ""}`
                      : (p.notes ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-ui-text-subtle px-4 py-2 text-xs">
          Drafts live in Desktop/vp-seo-output/02-p1-drafts/. A piece turns live
          on its own when /resources/&#123;slug&#125; is published in the page
          builder.
        </p>
      </section>
    </div>
  );
}

function BurnUp({ rows }: { rows: ContentPlan["burnUp"] }) {
  // Weeks as pseudo-days so the shared chart can draw them.
  const start = Date.parse("2026-09-28T00:00:00Z");
  const days = rows.map((r) =>
    new Date(start + (r.week - 1) * 7 * 86_400_000).toISOString().slice(0, 10),
  );
  return (
    <SeoTrendChart
      grain="fixed"
      ariaLabel="Pieces planned vs live, cumulative by week"
      days={days}
      series={[
        { label: "Planned", color: C.idle, values: rows.map((r) => r.planned) },
        {
          label: "Live",
          color: C.ok,
          values: rows.map((r) => (r.live < 0 ? null : r.live)),
        },
      ]}
    />
  );
}
