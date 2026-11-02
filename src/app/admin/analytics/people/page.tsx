import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AnalyticsDrillDown,
  drillDownParams,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { PeopleByChannel } from "@/components/admin/PeopleByChannel";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "People",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsPeoplePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { range } = drillDownParams(params);
  const channel = singleParam(params.channel)?.trim() || null;
  const { user, role } = await requireReadAccess();
  return (
    <AnalyticsDrillDown
      path="/admin/analytics/people"
      tab="people"
      title="People"
      description="Who booked from each channel, whether they showed, and what brought them."
      user={{ email: user.email, role }}
      range={range}
      trust={getTrustBar("people")}
    >
      <Suspense
        fallback={
          <p className="text-ui-text-muted text-sm">Loading the people…</p>
        }
      >
        <PeopleByChannel range={range} channel={channel} />
      </Suspense>
    </AnalyticsDrillDown>
  );
}
