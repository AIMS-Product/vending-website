import type { Metadata } from "next";
import Link from "next/link";
import { adminLinkClass } from "@/components/admin/AdminUi";
import {
  AnalyticsDrillDown,
  singleParam,
  type SearchParams,
} from "@/components/admin/dashboard/AnalyticsDrillDown";
import { FunnelBoardCrosswalk } from "@/components/admin/FunnelBoardCrosswalk";
import { FunnelBoardGrid } from "@/components/admin/FunnelBoardGrid";
import { pacificToday } from "@/lib/admin/format-time";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { addDays, mondayOf } from "@/lib/services/funnel-board";
import { getFunnelBoard } from "@/lib/services/funnel-board-data";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Funnel board",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function FunnelBoardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { user, role } = await requireReadAccess();
  const today = pacificToday();
  const requested = singleParam(params.week);
  const weekStart = mondayOf(
    requested && DAY.test(requested) ? requested : today,
  );
  const board = await getFunnelBoard(weekStart);
  const href = (week: string) => `/admin/analytics/board?week=${week}`;

  return (
    <AnalyticsDrillDown
      path="/admin/analytics/board"
      // No range: the board is a fixed two-week window with its own picker.
      tab="months"
      title="Funnel board"
      description="Site form fills and booked calls by channel and day, and where Close filed each call."
      user={{ email: user.email, role }}
      // Reads site leads and the Close mirror: the same feeds as month over month.
      trust={getTrustBar("mom")}
    >
      <nav className="mb-4 flex items-center gap-4 text-sm" aria-label="Week">
        <Link href={href(addDays(weekStart, -7))} className={adminLinkClass}>
          Previous week
        </Link>
        <span className="text-ui-text-muted">Week of {weekStart}</span>
        <Link href={href(addDays(weekStart, 7))} className={adminLinkClass}>
          Next week
        </Link>
        {weekStart !== mondayOf(today) ? (
          <Link href="/admin/analytics/board" className={adminLinkClass}>
            This week
          </Link>
        ) : null}
      </nav>
      <div className="space-y-5">
        <FunnelBoardGrid board={board} today={today} />
        <FunnelBoardCrosswalk board={board} />
      </div>
    </AnalyticsDrillDown>
  );
}
