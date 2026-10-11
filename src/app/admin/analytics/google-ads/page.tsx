import type { Metadata } from "next";
import {
  AnalyticsDrillDown,
  drillDownParams,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { adminEyebrowClass } from "@/components/admin/AdminUi";
import { GoogleAdsCeoView } from "@/components/admin/GoogleAdsCeoView";
import {
  GoogleAdsAds,
  GoogleAdsTable,
} from "@/components/admin/GoogleAdsPanels";
import {
  GoogleAdsBeforeAfter,
  GoogleAdsChangeLog,
  GoogleAdsHealth,
  GoogleAdsWaste,
  GoogleAdsWeekly,
} from "@/components/admin/GoogleAdsMediaBuyerPanels";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { ceoSummary } from "@/lib/services/google-ads-ceo";
import { getGoogleAdsDashboard } from "@/lib/services/google-ads-dashboard";
import { keywordNote } from "@/lib/services/google-ads-insights";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Google Ads",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsGoogleAdsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { range } = drillDownParams(params);
  const { user, role } = await requireReadAccess();
  const ads = await getGoogleAdsDashboard({ range });
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/google-ads"
      tab="google-ads"
      title="Google Ads"
      description="What Google Ads costs, what it brings back, and what needs a decision."
      user={{ email: user.email, role }}
      range={range}
      trust={getTrustBar("google-ads")}
    >
      {ads.synced ? null : (
        <p className="text-ui-text-muted mb-4 text-sm">
          No Google Ads spend for {ads.rangeLabel.toLowerCase()} yet. Spend
          arrives from the daily Google Ads script; leads and calls below are
          live.
        </p>
      )}
      <GoogleAdsCeoView
        rangeLabel={ads.rangeLabel}
        totals={ads.totals}
        beforeAfter={ads.beforeAfter}
        summary={ceoSummary(ads)}
      />
      <div className="mt-5 grid gap-5">
        <GoogleAdsWeekly weeks={ads.weeks} />
        <GoogleAdsTable
          title="By campaign"
          firstColumn="Campaign"
          rows={ads.campaigns}
          empty="No Google Ads spend or leads in this range."
        />
      </div>
      <details className="mt-8">
        <summary className={`${adminEyebrowClass} cursor-pointer`}>
          Media buyer detail: account health, keywords, search terms, ads,
          change log
        </summary>
        <div className="mt-5 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <GoogleAdsHealth
              health={ads.health}
              bookedInAds30d={ads.bookedInAds30d}
              setUp={ads.healthSetUp}
            />
            <GoogleAdsBeforeAfter data={ads.beforeAfter} />
          </div>
          <GoogleAdsTable
            title="By keyword"
            firstColumn="Keyword"
            rows={ads.keywords}
            empty="No keyword rows in this range."
            note={keywordNote(ads.keywords, ads.totals, ads.healthSetUp)}
          />
          <GoogleAdsWaste wasted={ads.wasted} setUp={ads.healthSetUp} />
          <GoogleAdsAds ads={ads.ads} />
          <GoogleAdsChangeLog />
        </div>
      </details>
    </AnalyticsDrillDown>
  );
}
