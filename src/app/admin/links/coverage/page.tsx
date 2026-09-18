import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminCardClass,
  adminEyebrowClass,
  adminLinkClass,
} from "@/components/admin/AdminUi";
import { getLinkCoverage } from "@/lib/services/link-coverage-data";
import {
  parseAdminAnalyticsRange,
  resolveAdminAnalyticsRange,
  ADMIN_ANALYTICS_RANGE_KEYS,
} from "@/lib/services/admin-analytics-range";
import type { LinkCoverageReport } from "@/lib/services/link-coverage";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Link coverage",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LinkCoveragePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rangeParam = params.range;
  const range = parseAdminAnalyticsRange(
    Array.isArray(rangeParam) ? rangeParam[0] : rangeParam,
  );
  const [{ user, role }, data] = await Promise.all([
    requireReadAccess(),
    getLinkCoverage({ range }),
  ]);

  return (
    <AdminShell
      activeSection="links"
      eyebrow="Marketing"
      title="Link coverage"
      description="How many leads arrived on a link that is actually in the registry, and which links are missing from it."
      userEmail={user.email}
      userRole={role}
    >
      <div className="space-y-5">
        <RangePills active={range} />
        <Summary data={data} />
        <ByChannel data={data} />
        <Worklist data={data} />
      </div>
    </AdminShell>
  );
}

function RangePills({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={`${adminEyebrowClass} mr-1`}>Window</span>
      {ADMIN_ANALYTICS_RANGE_KEYS.map((key) => (
        <Link
          key={key}
          href={`?range=${key}`}
          aria-current={key === active ? "true" : undefined}
          className={`rounded border px-2 py-1 text-xs transition ${
            key === active
              ? "border-ui-accent bg-ui-accent-soft text-ui-text font-medium"
              : "border-ui-line text-ui-text-subtle hover:text-ui-text"
          }`}
        >
          {resolveAdminAnalyticsRange(key).label}
        </Link>
      ))}
    </div>
  );
}

function Summary({ data }: { data: LinkCoverageReport }) {
  const { totals } = data;
  const tagged = totals.registered + totals.unregistered;

  return (
    <section className={adminCardClass} aria-label="Link coverage summary">
      <h2 className={adminEyebrowClass}>Coverage</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        {data.window.start} to {data.window.end}. A lead is covered when the five
        UTMs it arrived with match a row in the registry. The registry holds{" "}
        {data.registrySize === 1 ? "1 link" : `${data.registrySize} links`}.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Leads" value={count(totals.leads)} />
        <Stat
          label="On a registered link"
          value={count(totals.registered)}
          detail={
            totals.registeredPct === null
              ? "—"
              : `${totals.registeredPct.toFixed(1)}% of tagged`
          }
        />
        <Stat
          label="On an untracked link"
          value={count(totals.unregistered)}
          detail={`${data.worklist.length} distinct links`}
        />
        <Stat
          label="No link at all"
          value={count(totals.untagged)}
          detail="Direct, organic or on-site"
        />
      </dl>
      <p className="text-ui-text-subtle mt-4 text-xs">
        The rate is measured over the {count(tagged)} tagged leads only. A lead
        that arrived with no UTMs had no link to register, so counting it as a
        miss would blame the team for organic traffic.
      </p>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Leads only. <code>ga4_page_views</code> stores a source and a campaign
        and nothing else, so a visit cannot be tested for registry membership —
        the columns that would answer it do not exist.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt className={adminEyebrowClass}>{label}</dt>
      <dd className="text-ui-text mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </dd>
      {detail ? (
        <p className="text-ui-text-subtle mt-0.5 text-xs">{detail}</p>
      ) : null}
    </div>
  );
}

function ByChannel({ data }: { data: LinkCoverageReport }) {
  if (data.byChannel.length === 0) return null;

  return (
    <section className={adminCardClass} aria-label="Coverage by channel">
      <h2 className={adminEyebrowClass}>By channel</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        A dash means nothing in that channel carried a UTM, so there is no
        coverage to measure — never that coverage was zero.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-[0.8125rem]">
          <thead>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="py-2 pr-4 font-semibold">Channel</th>
              <th className="py-2 pr-3 text-right font-semibold">Leads</th>
              <th className="py-2 pr-3 text-right font-semibold">Registered</th>
              <th className="py-2 pr-3 text-right font-semibold">Untracked</th>
              <th className="py-2 pr-3 text-right font-semibold">No link</th>
              <th className="py-2 text-right font-semibold">Covered</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {data.byChannel.map((row) => (
              <tr key={row.channel}>
                <td className="text-ui-text py-2 pr-4 font-medium">
                  {row.channel}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {count(row.leads)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {count(row.registered)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {count(row.unregistered)}
                </td>
                <td className="text-ui-text-subtle py-2 pr-3 text-right tabular-nums">
                  {count(row.untagged)}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    row.registeredPct === null
                      ? "text-ui-text-subtle"
                      : row.registeredPct === 0
                        ? "text-ui-bad"
                        : ""
                  }`}
                >
                  {row.registeredPct === null
                    ? "—"
                    : `${row.registeredPct.toFixed(0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Worklist({ data }: { data: LinkCoverageReport }) {
  if (data.worklist.length === 0) {
    return (
      <section className={adminCardClass} aria-label="Links to rebuild">
        <h2 className={adminEyebrowClass}>Links to rebuild</h2>
        <p className="text-ui-text-muted mt-2 text-sm">
          Every tagged lead in this window arrived on a registered link.
        </p>
      </section>
    );
  }

  return (
    <section className={adminCardClass} aria-label="Links to rebuild">
      <h2 className={adminEyebrowClass}>
        Links to rebuild ({data.worklist.length})
      </h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Each row is a UTM combination that brought leads and is not in the
        registry. Rebuild it through the{" "}
        <Link href="/admin/links" className={adminLinkClass}>
          link builder
        </Link>{" "}
        so it carries a destination, then replace the live link.
      </p>
      <p className="text-ui-text-subtle mt-1 text-xs">
        The landing path is shown so you can recognise the link. It is not the
        destination: only the person who built the link knows where it meant to
        send people, which is exactly why <code>utm_term</code> exists.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-[0.8125rem]">
          <thead>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="py-2 pr-3 font-semibold">Channel</th>
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 font-semibold">Medium</th>
              <th className="py-2 pr-3 font-semibold">Campaign</th>
              <th className="py-2 pr-3 font-semibold">Content</th>
              <th className="py-2 pr-3 font-semibold">Destination</th>
              <th className="py-2 pr-3 text-right font-semibold">Leads</th>
              <th className="py-2 font-semibold">Landed on</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {data.worklist.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="text-ui-text py-2 pr-3 font-medium whitespace-nowrap">
                  {row.channel}
                </td>
                <Utm value={row.source} />
                <Utm value={row.medium} />
                <Utm value={row.campaign} />
                <Utm value={row.content} />
                <Utm value={row.term} />
                <td className="py-2 pr-3 text-right tabular-nums">
                  {count(row.leads)}
                </td>
                <td className="text-ui-text-subtle py-2 text-xs">
                  {row.landingPaths.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A missing UTM is a dash in the muted tone: it is the thing to go fix. */
function Utm({ value }: { value: string | null }) {
  return (
    <td
      className={`py-2 pr-3 ${value === null ? "text-ui-bad" : "text-ui-text-muted"}`}
    >
      {value ?? "—"}
    </td>
  );
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}
