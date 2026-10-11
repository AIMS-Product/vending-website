import type { Metadata } from "next";
import {
  AnalyticsDrillDown,
  drillDownParams,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import {
  GoogleAdsCreatives,
  GoogleAdsTable,
  GoogleAdsTotals,
} from "@/components/admin/GoogleAdsPanels";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getGoogleAdsDashboard } from "@/lib/services/google-ads-dashboard";
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
      description="Spend, leads, booked calls and wins by campaign and keyword. Leads are site leads with a Google click id; wins are those leads' closed deals."
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
      <GoogleAdsTotals totals={ads.totals} />
      <div className="mt-5 grid gap-5">
        <GoogleAdsTable
          title="By campaign"
          firstColumn="Campaign"
          rows={ads.campaigns}
          empty="No Google Ads spend or leads in this range."
        />
        <GoogleAdsTable
          title="By keyword"
          firstColumn="Keyword"
          rows={ads.keywords}
          empty="No keyword rows in this range."
        />
        <GoogleAdsCreatives creatives={ads.creatives} />
      </div>
    </AnalyticsDrillDown>
  );
}
