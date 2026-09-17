import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPanelClass } from "@/components/admin/AdminUi";
import { CacMonthControls, CacTable } from "@/components/admin/CacPanels";
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

          {data.daysInMonthLooksWrong ? (
            <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Days in month does not match the calendar for this month. The
              spreadsheet carried this over, and it prorates every fixed cost on
              the page, so it is worth correcting above before reading the
              numbers.
            </p>
          ) : null}

          {data.report.total.routesWithSpendDisagreement > 0 ? (
            <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {data.report.total.routesWithSpendDisagreement}{" "}
              {data.report.total.routesWithSpendDisagreement === 1
                ? "route has"
                : "routes have"}{" "}
              a typed spend that disagrees with the ads data. Both numbers are
              on the row. The spreadsheet resolved this by typing over the
              total, which hid the gap; nothing here picks one for you.
            </p>
          ) : null}

          {data.report.total.routesWithoutCostModel > 0 ? (
            <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {data.report.total.routesWithoutCostModel}{" "}
              {data.report.total.routesWithoutCostModel === 1
                ? "route"
                : "routes"}{" "}
              carry closes with no cost model. Those closes sit in the blended
              CAC below while contributing no cost, which pulls it down. Give
              them a fixed monthly cost to fix that.
            </p>
          ) : null}

          <CacTable report={data.report} />

          <section className={`${adminPanelClass} mt-6 p-4`}>
            <h2 className="text-ui-text mb-2 text-sm font-semibold">
              What is live and what is still yours to fill in
            </h2>
            <ul className="text-ui-text-subtle list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong className="text-ui-text">Live:</strong> ad spend for the
                routes that name a channel, and the proration, which now follows
                the calendar instead of a cell somebody retypes each week.
              </li>
              <li>
                <strong className="text-ui-text">Imported:</strong> every fixed
                cost, variable spend, closed-won count and March benchmark,
                exactly as the workbook had them for May through September.
              </li>
              <li>
                <strong className="text-ui-text">Still manual:</strong> salaries
                and contracting, which no system here can see. Closed-won is
                manual too; it is not yet joined to Close.
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
