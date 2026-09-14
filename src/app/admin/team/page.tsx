import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";
import {
  AdsTable,
  ClosersTable,
  SettersTable,
  SocialsTable,
  WebinarsTable,
} from "@/components/admin/TeamPanels";
import {
  getTeamTab,
  parseTeamTab,
  TEAM_TABS,
  type TeamTabKey,
} from "@/lib/services/team-report-data";
import {
  parseGoalPeriod,
  type GoalPeriodKey,
} from "@/lib/services/goal-report";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

// Read fresh on every load: these are the numbers people compare in a meeting.
export const dynamic = "force-dynamic";

const PERIODS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "2026-07", label: "July" },
  { key: "2026-08", label: "August" },
  { key: "2026-09", label: "September" },
  { key: "2026-10", label: "October" },
  { key: "2026-11", label: "November" },
  { key: "2026-12", label: "December" },
  { key: "q4", label: "Q4 total" },
];

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const tab = parseTeamTab(singleParam(params.tab));
  const period = parseGoalPeriod(singleParam(params.month), now);
  const activePeriod = periodParam(period);

  const [{ user, role }, data] = await Promise.all([
    requireReadAccess(),
    getTeamTab({ tab, period, now }),
  ]);

  return (
    <AdminShell
      activeSection="team"
      eyebrow="Reporting"
      title="Team"
      description="Setters and closers by name, then the webinar, social and paid programs that feed them. Booked calls are Close first sales calls, the same count the goals page uses."
      userEmail={user.email}
      userRole={role}
    >
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Period">
        {PERIODS.map((entry) => (
          <Link
            key={entry.key}
            href={href(tab, entry.key)}
            aria-current={entry.key === activePeriod ? "page" : undefined}
            className={`rounded-ui border px-3 py-1.5 text-sm ${
              entry.key === activePeriod
                ? "border-ui-accent bg-ui-accent text-white"
                : "border-ui-line-strong bg-ui-surface text-ui-text-muted hover:bg-ui-canvas"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <nav
        className="border-ui-line mb-5 flex flex-wrap gap-1 border-b"
        aria-label="Team sections"
      >
        {TEAM_TABS.map((entry) => {
          const isActive = entry.key === tab;
          return (
            <Link
              key={entry.key}
              href={href(entry.key, activePeriod)}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition ${
                isActive
                  ? "text-ui-text border-ui-accent"
                  : "text-ui-text-subtle hover:text-ui-text border-transparent"
              }`}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      <p className="text-ui-text-subtle mb-4 text-xs">
        {data.periodLabel} ({data.period.start} to {data.period.end}). A dash
        means not observed, never zero.
      </p>

      {data.setters ? (
        <SettersTable report={data.setters} connected={data.connected} />
      ) : null}
      {data.closers ? (
        <ClosersTable report={data.closers} connected={data.connected} />
      ) : null}
      {data.webinars ? <WebinarsTable report={data.webinars} /> : null}
      {data.socials ? <SocialsTable report={data.socials} /> : null}
      {data.ads ? (
        <AdsTable report={data.ads} connected={data.connected} />
      ) : null}

      {!data.setters &&
      !data.closers &&
      !data.webinars &&
      !data.socials &&
      !data.ads ? (
        <p className={`${adminPanelClass} p-4 text-sm`}>Nothing to show.</p>
      ) : null}
    </AdminShell>
  );
}

function href(tab: TeamTabKey, period: string): string {
  return `/admin/team?tab=${tab}&month=${period}`;
}

function periodParam(period: GoalPeriodKey): string {
  return period.kind === "q4" ? "q4" : period.month;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
