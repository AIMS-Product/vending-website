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
  BookedPaceStrip,
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
      description="Two goals on two bases. Daily pace counts new calls the day they were booked; the monthly plan counts Close first calls the day they are scheduled for. No arithmetic runs between them."
      userEmail={user.email}
      userRole={role}
    >
      <section className="mb-8" aria-labelledby="daily-pace">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="daily-pace" className="text-ui-text text-base font-semibold">
            Daily pace — new calls booked
          </h2>
          <p className="text-ui-text-subtle text-xs">
            Booked-on basis, Lane 2 excluded, Eastern day. The 25 a day is
            Jess&rsquo;s floor goal and the 42 is the capacity
            dashboard&rsquo;s; neither comes from the Q4 plan below.
          </p>
        </div>
        {pace.connected ? null : (
          <p className={`${adminPanelClass} mb-4 p-4 text-sm`}>
            The booking tables could not be read in this environment, so every
            number below reads as not observed rather than zero.
          </p>
        )}
        <BookedPaceStrip pace={pace} />
        <div className="grid gap-4">
          <BookedDefinitions pace={pace} />
          <BookedAttribution pace={pace} />
          <BookedForward pace={pace} />
          <BookedMappingReview pace={pace} />
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ui-text text-base font-semibold">
          Monthly plan — Close first sales calls
        </h2>
        <p className="text-ui-text-subtle text-xs">
          Lands-on basis, first call per lead, deduplicated. Targets grow 10% a
          month from each channel&rsquo;s August.
        </p>
      </div>

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
