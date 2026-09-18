import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";
import {
  CacAutoRefresh,
  CacMonthControls,
  CacTable,
} from "@/components/admin/CacPanels";
import { getCacPageData } from "@/lib/services/cac-report-data";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "CAC tracker",
  robots: { index: false, follow: false },
};

// Prorates against today, so it must not be cached.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function AdminCacPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // requireAdmin, not requireReadAccess: every cell on this page is an input and
  // every save goes through requireAdmin anyway, so showing a viewer a form that
  // rejects them on submit would be worse than not showing it. Deliberate, per
  // src/lib/admin/viewer-access.test.ts.
  const [{ user, role }, data] = await Promise.all([
    requireAdmin(),
    getCacPageData(single(params.month)),
  ]);

  return (
    <AdminShell
      activeSection="cac"
      eyebrow="Reporting"
      title="CAC tracker"
      description="Cost per acquisition by route, month to date. Fixed costs prorate by the share of the month elapsed; variable spend is either typed here or read from the ads data, never both."
      userEmail={user.email}
      userRole={role}
    >
      {data.unavailable ? (
        <p className={`${adminPanelClass} text-ui-text p-4 text-sm`}>
          {data.unavailable}
        </p>
      ) : null}

      {data.months.length > 1 ? (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Month">
          {data.months.map((month) => {
            const active = month.month === data.report?.month;
            return (
              <Link
                key={month.month}
                href={`/admin/cac?month=${month.month}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset ${
                  active
                    ? "bg-ui-accent text-white ring-transparent"
                    : "text-ui-text ring-ui-border"
                }`}
              >
                {month.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {data.report ? (
        <>
          <CacMonthControls report={data.report} />

          {(() => {
            const notices = [
              data.closeError
                ? `Close could not be read (${data.closeError}), so every route is using its typed closed-won count this load.`
                : null,
              data.daysInMonthLooksWrong
                ? "Days in month does not match the calendar, and it prorates every fixed cost on this page. Worth correcting above before reading the numbers."
                : null,
              data.report.total.routesWithSpendDisagreement > 0
                ? `${data.report.total.routesWithSpendDisagreement} ${data.report.total.routesWithSpendDisagreement === 1 ? "route has a typed spend that disagrees" : "routes have typed spend that disagrees"} with the ads feed. Both numbers are on the row; nothing here picks one for you.`
                : null,
              data.report.total.routesWithoutCostModel > 0
                ? `${data.report.total.routesWithoutCostModel} ${data.report.total.routesWithoutCostModel === 1 ? "route carries closes" : "routes carry closes"} with no cost model, so those closes pull the blended CAC down while adding no cost.`
                : null,
            ].filter((notice): notice is string => notice != null);
            if (!notices.length) return null;
            return (
              <div className="border-ui-line bg-ui-surface rounded-ui-lg mb-5 border p-4">
                <h2 className="text-ui-text mb-2 text-sm font-semibold">
                  Worth knowing before you read these numbers
                </h2>
                <ul className="text-ui-text-muted space-y-1.5 text-sm">
                  {notices.map((notice) => (
                    <li key={notice} className="flex gap-2">
                      <span
                        aria-hidden
                        className="bg-ui-warn mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <span>{notice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          <CacTable report={data.report} />
          <CacAutoRefresh />

          <section className={`${adminPanelClass} mt-6 p-4`}>
            <h2 className="text-ui-text mb-2 text-sm font-semibold">
              What is live and what is still yours to fill in
            </h2>
            <ul className="text-ui-text-subtle list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong className="text-ui-text">Live:</strong> ad spend for the
                routes that name a channel; the proration, which follows the
                calendar; and closed-won, counted from Close by the date each
                deal was won and the lead&rsquo;s funnel. A route Close has no
                funnel for uses its typed count, and says so.
              </li>
              <li>
                <strong className="text-ui-text">Imported:</strong> every fixed
                cost, variable spend, closed-won count and March benchmark,
                exactly as the workbook had them for May through September.
              </li>
              <li>
                <strong className="text-ui-text">Still manual:</strong> fixed
                cost (people, contractors and software per route), which no
                system here can see. From September it follows Kody&rsquo;s CAC
                Worksheet; each row&rsquo;s notes give the split.
              </li>
              <li>
                Every white cell is editable and saves on its own row. A blank
                cell means not recorded and prints a dash, which is never read
                as zero.
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
