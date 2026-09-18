import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import type {
  FunnelMonthlyReport,
  FunnelPeriod,
  FunnelPeriodRow,
} from "@/lib/services/funnel-monthly";

/**
 * The Funnels tab: one row per page that captures leads, by month.
 *
 * The Channels tab answers "which traffic source converts". This answers
 * "which page converts", which is the question you can act on, because the
 * page is the thing we change. A dash is always "not observed", never zero.
 */
export function FunnelMonthlyTab({ data }: { data: FunnelMonthlyReport }) {
  if (data.months.length === 0) {
    return (
      <div className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          No leads have been captured yet, so there is no funnel to report.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Caveats data={data} />
      {data.beforeAfter ? <BeforeAfter data={data} /> : null}
      {data.months.map((month) => (
        <PeriodTable
          key={month.key}
          period={month}
          title={month.label}
          basis={`Leads captured between ${month.start} and ${month.end}, with every later stage counted for those same people whenever it happened. A call booked in this month by someone who arrived last month belongs to last month's row.`}
        />
      ))}
    </div>
  );
}

/**
 * The three things a reader has to know before trusting a number here, said
 * once at the top rather than in a footnote under each table.
 */
function Caveats({ data }: { data: FunnelMonthlyReport }) {
  return (
    <div className={adminCardClass}>
      <h2 className={adminEyebrowClass}>Before you read these</h2>
      <ul className="text-ui-text-subtle mt-2 space-y-1.5 text-xs">
        <li>
          <strong className="text-ui-text">A dash is not a zero.</strong> It
          means nothing was observed, or the group is too young to judge.
        </li>
        <li>
          <strong className="text-ui-text">
            Opt-in stops at {data.visitsThrough ?? "—"}.
          </strong>{" "}
          GA4 reports a day late, so the visit rate is measured only over days
          it has finished counting — on both sides of the division.
        </li>
        <li>
          <strong className="text-ui-text">
            Half-filled forms are counted after contact details, not before.
          </strong>{" "}
          The form writes a lead row at the first submit, so somebody who typed
          and left before that leaves no trace anywhere. &ldquo;Qs&rdquo; below
          is people who gave us their number and then abandoned the questions.
        </li>
        <li>
          <strong className="text-ui-text">Win % waits 30 days.</strong> The Won
          count does not — a sale is a fact the day it happens. The rate only
          opens once the calls behind it are old enough that a missing sale
          means something.
        </li>
        <li>
          <strong className="text-ui-text">
            Show rate covers {formatPct(data.showCoverage.pct)} of booked calls
          </strong>{" "}
          ({data.showCoverage.known} of {data.showCoverage.total} old enough to
          judge carry a yes/no in Close). The rest leave the denominator rather
          than counting as no-shows.
        </li>
      </ul>
    </div>
  );
}

/**
 * The two windows either side of the rebuild, on the same weekdays.
 *
 * Four things shipped that day — the form moved onto the first screen, the
 * chrome came off, four dead routes got a calendar, eleven URLs redirected —
 * so this says what moved, not which change moved it.
 */
function BeforeAfter({ data }: { data: FunnelMonthlyReport }) {
  const { before, after, changedOn } = data.beforeAfter!;
  const funnels = [
    ...new Set([
      ...after.rows.map((row) => row.funnel),
      ...before.rows.map((row) => row.funnel),
    ]),
  ];
  const rowFor = (period: FunnelPeriod, funnel: string) =>
    period.rows.find((row) => row.funnel === funnel);

  return (
    <section
      className={adminCardClass}
      aria-label="Before and after the rebuild"
    >
      <h2 className={adminEyebrowClass}>Since the funnel rebuild</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        {after.label} against {before.label} — the same weekdays a week apart,
        because bookings are weekday-shaped. The rebuild shipped {changedOn}.
        This is far too short a window to conclude anything; it is here so the
        starting point is on the record.
      </p>
      {after.visitsEnd && after.visitsEnd < after.end ? (
        <p className="text-ui-text-subtle mt-1 text-xs">
          Visit counts in the later window stop at {after.visitsEnd}, so it
          holds fewer days of traffic than the earlier one. The rates are not
          affected — both sides of each division use the same days — but do not
          read the two visit totals against each other.
        </p>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-[0.8125rem]">
          <thead>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="py-2 pr-4 font-semibold">Funnel</th>
              <Th>Leads before</Th>
              <Th>Leads after</Th>
              <Th>Book % before</Th>
              <Th>Book % after</Th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {funnels.map((funnel) => {
              const wasBefore = rowFor(before, funnel);
              const isAfter = rowFor(after, funnel);
              return (
                <tr key={funnel}>
                  <td className="py-2 pr-4 align-middle">
                    <FunnelName
                      funnel={funnel}
                      isBookingFunnel={
                        (isAfter ?? wasBefore)?.isBookingFunnel ?? false
                      }
                    />
                  </td>
                  <Td>{wasBefore?.leads ?? 0}</Td>
                  <Td>{isAfter?.leads ?? 0}</Td>
                  <Td>{formatPct(wasBefore?.rates.leadToBook ?? null)}</Td>
                  <Td>{formatPct(isAfter?.rates.leadToBook ?? null)}</Td>
                </tr>
              );
            })}
            <tr className="font-medium">
              <td className="py-2 pr-4">All funnels</td>
              <Td>{before.totals.leads}</Td>
              <Td>{after.totals.leads}</Td>
              <Td>{formatPct(before.totals.rates.leadToBook)}</Td>
              <Td>{formatPct(after.totals.rates.leadToBook)}</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PeriodTable({
  period,
  title,
  basis,
}: {
  period: FunnelPeriod;
  title: string;
  basis: string;
}) {
  if (period.rows.length === 0) return null;
  return (
    <section className={adminCardClass} aria-label={title}>
      <h2 className={adminEyebrowClass}>{title}</h2>
      {period.visitsEnd && period.visitsEnd < period.end ? (
        <p className="text-ui-text-subtle mt-1 text-xs">
          Visits cover {period.start} to {period.visitsEnd}; leads and
          everything after cover the full month. Rates are unaffected.
        </p>
      ) : null}
      <p className="text-ui-text-subtle mt-1 text-xs">
        <details className="inline">
          <summary className="text-ui-text-muted hover:text-ui-text cursor-pointer list-none underline decoration-dotted underline-offset-2">
            How this is measured
          </summary>
          <span className="mt-1 block">{basis}</span>
        </details>
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[68rem] text-[0.8125rem]">
          <thead>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="bg-ui-surface border-ui-line sticky left-0 z-10 border-r py-2 pr-4 pl-0 font-semibold">
                Funnel
              </th>
              <Th>Visits</Th>
              <Th>Leads</Th>
              <Th>Opt-in %</Th>
              <Th>Qs offered</Th>
              <Th>Qs left</Th>
              <Th>Qs done %</Th>
              <Th>Booked</Th>
              <Th>Book %</Th>
              <Th>Held</Th>
              <Th>Show %</Th>
              <Th>Won</Th>
              <Th>Win %</Th>
              <Th>Revenue</Th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {period.rows.map((row) => (
              <Row key={row.funnel} row={row} />
            ))}
            <tr className="font-medium">
              <td className="bg-ui-surface border-ui-line sticky left-0 z-10 border-r py-2.5 pr-4 pl-0">
                All funnels
              </td>
              <Cells row={period.totals} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ row }: { row: FunnelPeriodRow }) {
  return (
    <tr>
      <td
        className="bg-ui-surface border-ui-line sticky left-0 z-10 min-w-[14rem] border-r py-2.5 pr-4 pl-0 align-middle"
        title={
          row.pendingShow > 0 || row.showUnlogged > 0
            ? `${row.pendingShow} call(s) not held yet, ${row.showUnlogged} held with no outcome logged — both are out of the show rate`
            : undefined
        }
      >
        <FunnelName funnel={row.funnel} isBookingFunnel={row.isBookingFunnel} />
      </td>
      <Cells row={row} />
    </tr>
  );
}

function Cells({ row }: { row: FunnelPeriodRow }) {
  return (
    <>
      <Td>{row.visits ?? "—"}</Td>
      <Td>{row.leads}</Td>
      <Td>{formatPct(row.rates.visitToLead)}</Td>
      <Td>{row.questionsOffered || "—"}</Td>
      <Td>{row.questionsOffered ? row.questionsAbandoned : "—"}</Td>
      <Td>{formatPct(row.rates.questionsCompleted)}</Td>
      <Td>{row.booked}</Td>
      <Td>{formatPct(row.rates.leadToBook)}</Td>
      <Td>{row.showable ? row.held : "—"}</Td>
      <Td>{formatPct(row.rates.bookToShow)}</Td>
      <Td>{row.won}</Td>
      <Td>{formatPct(row.rates.showToWin)}</Td>
      <Td>
        {row.revenue === null
          ? "—"
          : `$${row.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
      </Td>
    </>
  );
}

/**
 * A registered booking funnel is marked, because the rest of the list is
 * pages that happen to carry a form — the homepage, a blog post, the
 * newsletter — and judging a news article by its booking rate is a category
 * error.
 */
function FunnelName({
  funnel,
  isBookingFunnel,
}: {
  funnel: string;
  isBookingFunnel: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-ui-text font-medium whitespace-nowrap">
        {funnel}
      </span>
      {isBookingFunnel ? (
        <span
          className="border-ui-line text-ui-text-subtle rounded border px-1 text-[0.625rem] whitespace-nowrap"
          title="A registered booking funnel"
        >
          funnel
        </span>
      ) : null}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 pr-3 text-right font-semibold whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-2.5 pr-3 text-right align-middle whitespace-nowrap tabular-nums">
      {children}
    </td>
  );
}

function formatPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}
