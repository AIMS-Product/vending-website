import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";
import {
  GoalBasis,
  GoalHeadline,
  GoalTable,
} from "@/components/admin/GoalPanels";
import {
  getGoalReport,
  parseGoalPeriod,
  type GoalPeriodKey,
} from "@/lib/services/goal-report";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Channel goals",
  robots: { index: false, follow: false },
};

// Read fresh on every load: this is the page that says ahead or behind today.
export const dynamic = "force-dynamic";

const PERIODS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "2026-09", label: "September" },
  { key: "2026-10", label: "October" },
  { key: "2026-11", label: "November" },
  { key: "2026-12", label: "December" },
  { key: "q4", label: "Q4 total" },
];

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminGoalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const now = new Date();
  const period = parseGoalPeriod(singleParam(params.month), now);

  const [{ user, role }, report] = await Promise.all([
    requireReadAccess(),
    getGoalReport({ period, now }),
  ]);

  const activeKey = periodParam(period);

  return (
    <AdminShell
      activeSection="goals"
      eyebrow="Reporting"
      title="Channel goals"
      description="The 800-call plan against what Close has booked, by channel. Every number here is a first sales call on a Close lead, so a target and its actual are the same count the plan was written on."
      userEmail={user.email}
      userRole={role}
    >
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Period">
        {PERIODS.map((entry) => (
          <Link
            key={entry.key}
            href={`/admin/goals?month=${entry.key}`}
            aria-current={entry.key === activeKey ? "page" : undefined}
            className={`rounded-ui border px-3 py-1.5 text-sm ${
              entry.key === activeKey
                ? "border-ui-accent bg-ui-accent text-white"
                : "border-ui-line-strong bg-ui-surface text-ui-text-muted hover:bg-ui-canvas"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {report.connected ? null : (
        <p className={`${adminPanelClass} mb-4 p-4 text-sm`}>
          The Close mirror table is not available in this environment yet, so
          every actual reads as not observed. Apply the close_lead_funnel
          migration and run the hourly sync once.
        </p>
      )}

      {report.targetsApply ? null : (
        <p className={`${adminPanelClass} mb-4 p-4 text-sm`}>
          The plan starts in September 2026. This period shows what was booked
          with no target against it.
        </p>
      )}

      <GoalHeadline report={report} />
      <div className="grid gap-4">
        <GoalTable report={report} />
        <GoalBasis report={report} />
      </div>
    </AdminShell>
  );
}

function periodParam(period: GoalPeriodKey): string {
  return period.kind === "q4" ? "q4" : period.month;
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
