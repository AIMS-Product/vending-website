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
  BookedAttribution,
  BookedDefinitions,
  BookedForward,
  BookedMappingReview,
  BookedPaceHeadline,
} from "@/components/admin/BookedPacePanels";
import { getBookedPace } from "@/lib/services/booked-metrics-data";
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

  const [{ user, role }, report, pace] = await Promise.all([
    requireReadAccess(),
    getGoalReport({ period, now }),
    getBookedPace({ now }),
  ]);

  const activeKey = periodParam(period);

  return (
    <AdminShell
      activeSection="goals"
      eyebrow="Reporting"
      title="Channel goals"
      description="Two goals on two different bases, kept apart on purpose. Daily pace counts new calls on the day they were booked. The monthly plan counts Close first sales calls on the day they are scheduled for. They are not two views of one number and no arithmetic runs between them."
      userEmail={user.email}
      userRole={role}
    >
      <section className="mb-8" aria-labelledby="daily-pace">
        <h2
          id="daily-pace"
          className="text-ui-text mb-1 text-base font-semibold"
        >
          Daily pace — new calls booked
        </h2>
        <p className="text-ui-text-muted mb-3 max-w-prose text-[0.8125rem]">
          Counts a call on the day someone booked it, which is what marketing
          did that day. Lane 2 outbound is excluded so it cannot flatter the
          number.
        </p>
        {pace.connected ? null : (
          <p className={`${adminPanelClass} mb-4 p-4 text-sm`}>
            The booking tables could not be read in this environment, so every
            number below reads as not observed rather than zero.
          </p>
        )}
        <div className="grid gap-4">
          <BookedPaceHeadline pace={pace} />
          <BookedMappingReview pace={pace} />
          <BookedAttribution pace={pace} />
          <BookedForward pace={pace} />
          <BookedDefinitions pace={pace} />
        </div>
      </section>

      <h2 className="text-ui-text mb-1 text-base font-semibold">
        Monthly plan — Close first sales calls
      </h2>
      <p className="text-ui-text-muted mb-3 max-w-prose text-[0.8125rem]">
        A different count: first call per lead, deduplicated, dated by the day
        the call is scheduled for. This is the basis the 800-a-month plan was
        written and baselined on.
      </p>

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
