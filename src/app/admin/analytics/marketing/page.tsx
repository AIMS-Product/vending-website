import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import { AnalyticsDrillDown } from "@/components/admin/dashboard/AnalyticsDrillDown";
import { MarketingMtdPanel } from "@/components/admin/MarketingMtdPanel";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getMarketingMtd } from "@/lib/services/marketing-mtd-data";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Marketing MTD",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Jess's marketing month to date: a fixed window, so no date range. */
export default async function AnalyticsMarketingPage() {
  const { user, role } = await requireReadAccess();
  const report = getMarketingMtd();
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/marketing"
      tab="marketing"
      title="Marketing MTD"
      description="Every marketing channel except Reactivation Scrapers: booked, shown, qualified, won and days to win, against the same dates last month and the 125-a-week goal."
      user={{ email: user.email, role }}
      trust={getTrustBar("close")}
    >
      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-label="Loading marketing month to date"
            className={`${adminCardClass} bg-ui-canvas h-72 animate-pulse`}
          />
        }
      >
        <Body report={report} />
      </Suspense>
    </AnalyticsDrillDown>
  );
}

async function Body({
  report,
}: {
  report: ReturnType<typeof getMarketingMtd>;
}) {
  return <MarketingMtdPanel report={await report} />;
}
