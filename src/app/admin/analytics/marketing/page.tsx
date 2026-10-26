import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminCardClass, adminPanelClass } from "@/components/admin/AdminUi";
import {
  AnalyticsDrillDown,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { MarketingMtdPanel } from "@/components/admin/MarketingMtdPanel";
import {
  MarketingScorecardTab,
  MarketingWebinars,
} from "@/components/admin/MarketingScorecard";
import { PrintButton } from "@/components/admin/PrintButton";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getMarketingMtd } from "@/lib/services/marketing-mtd-data";
import { getMarketingCredit } from "@/lib/services/marketing-credit-data";
import { MarketingCreditPanel } from "@/components/admin/MarketingCreditPanel";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Marketing MTD",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "mtd", label: "Month to date" },
  { key: "scorecard", label: "Q4 scorecard" },
  { key: "credit", label: "Marketing credit" },
] as const;

type View = (typeof VIEWS)[number]["key"];

/** The marketing month so far on Jess's field rule: a fixed window, so no date range. */
export default async function AnalyticsMarketingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const requested = singleParam((await searchParams).view);
  const view: View =
    requested === "scorecard" || requested === "credit" ? requested : "mtd";
  const { user, role } = await requireReadAccess();
  // Not started on the credit view: that view never reads it.
  const report = view === "credit" ? null : getMarketingMtd();
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/marketing"
      tab="marketing"
      title="Marketing MTD"
      description="Booked leads by Close Funnel Name on Jess's field rule, with open calls, shows, qualified, wins and spend, against the same dates last month; plus the Q4 scorecard rows."
      user={{ email: user.email, role }}
      trust={getTrustBar(view === "credit" ? "credit" : "marketing")}
    >
      <nav
        aria-label="Marketing MTD views"
        className="flex flex-wrap items-center gap-2 print:hidden"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={
              v.key === "mtd"
                ? "/admin/analytics/marketing"
                : `/admin/analytics/marketing?view=${v.key}`
            }
            aria-current={view === v.key ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${view === v.key ? "bg-ui-text text-ui-surface" : "text-ui-text-muted hover:bg-ui-canvas"}`}
          >
            {v.label}
          </Link>
        ))}
        <span className="ml-auto">
          <PrintButton />
        </span>
      </nav>
      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="Loading marketing month to date"
            className={`${adminCardClass} bg-ui-canvas h-72 animate-pulse`}
          />
        }
      >
        {view === "credit" ? (
          <CreditBody />
        ) : (
          <Body report={report} view={view} />
        )}
      </Suspense>
    </AnalyticsDrillDown>
  );
}

async function Body({
  report,
  view,
}: {
  report: ReturnType<typeof getMarketingMtd> | null;
  view: "mtd" | "scorecard";
}) {
  if (!report) return null;
  const loaded = await report;
  if (!loaded.ok) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-bad px-4 py-4 text-sm">
          The marketing month to date could not be read, so it is not shown:{" "}
          {loaded.error}
        </p>
      </section>
    );
  }
  if (view === "scorecard") {
    return (
      <MarketingScorecardTab card={loaded.scorecard} today={loaded.today} />
    );
  }
  return (
    <div className="space-y-5">
      <MarketingMtdPanel report={loaded} />
      <MarketingWebinars events={loaded.webinars} mtd={loaded.mtd} />
    </div>
  );
}

async function CreditBody() {
  const loaded = await getMarketingCredit();
  if (!loaded.ok) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-bad px-4 py-4 text-sm">
          Marketing credit could not be read, so it is not shown: {loaded.error}
        </p>
      </section>
    );
  }
  return <MarketingCreditPanel report={loaded} />;
}
