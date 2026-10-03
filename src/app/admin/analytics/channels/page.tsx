import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import { ChannelsTab } from "@/components/admin/ChannelsPanels";
import {
  AnalyticsDrillDown,
  drillDownParams,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { getChannelsTab } from "@/lib/services/channel-report";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { canEditAdmin, requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Channels",
  robots: { index: false, follow: false },
};

// Reporting reflects the database on every load.
export const dynamic = "force-dynamic";

export default async function AnalyticsChannelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { range, includeInternal } = drillDownParams(params);
  const { user, role } = await requireReadAccess();
  const data = getChannelsTab({
    range,
    channel: singleParam(params.channel),
    includeInternal,
  });
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/channels"
      tab="channels"
      title="Channels"
      description="Spend, visits, leads, bookings and sales by channel, campaign and creative."
      user={{ email: user.email, role }}
      range={range}
      includeInternal={includeInternal}
      trust={getTrustBar("channels")}
    >
      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div
            aria-busy="true"
            aria-label="Loading channels"
            className={`${adminCardClass} bg-ui-canvas h-96 animate-pulse`}
          />
        }
      >
        <ChannelsBody
          data={data}
          range={range}
          includeInternal={includeInternal}
          canEdit={canEditAdmin(role)}
        />
      </Suspense>
    </AnalyticsDrillDown>
  );
}

async function ChannelsBody({
  data,
  ...props
}: {
  data: ReturnType<typeof getChannelsTab>;
  range: Parameters<typeof ChannelsTab>[0]["range"];
  includeInternal: boolean;
  canEdit: boolean;
}) {
  return <ChannelsTab data={await data} {...props} />;
}
