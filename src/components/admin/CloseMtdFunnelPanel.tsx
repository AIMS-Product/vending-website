import {
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { SCRAPER_FUNNEL } from "@/lib/services/close-mtd-funnel";
import type { CloseMtdReport } from "@/lib/services/close-mtd-funnel-data";

/**
 * The month so far, in the shape of Stephen's MTD funnel and none of its
 * arithmetic. Every stage prints the population it counted and the Close
 * field it read, so a number here can be argued with on its own terms rather
 * than checked against somebody's sheet.
 */

const TH = "px-3 py-2.5 text-right font-semibold whitespace-nowrap";
const TH_LEFT = "px-4 py-2.5 text-left font-semibold whitespace-nowrap";
const TD = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
const TD_LEFT = "px-4 py-2 text-left whitespace-nowrap";

/** "September 1-21, 2026" — the window, not an ordinal nobody can pluralise. */
function monthLabel(from: string, to: string): string {
  const month = new Date(`${from}T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  return `${month} ${Number(from.slice(8, 10))}\u2013${Number(to.slice(8, 10))}, ${from.slice(0, 4)}`;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function rate(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export function CloseMtdFunnelPanel({ report }: { report: CloseMtdReport }) {
  if (!report.ok) {
    return (
      <section className={adminPanelClass}>
        <p className="text-ui-bad text-sm">
          The month-to-date funnel could not be read, so it is not shown:{" "}
          {report.error}
        </p>
      </section>
    );
  }
  const { funnel } = report;

  return (
    <div className="space-y-5">
      <section className={adminPanelClass} aria-label="Month to date funnel">
        <div className="px-4 pt-4">
          <h2 className={adminSectionTitleClass}>
            {monthLabel(funnel.from, funnel.to)}, from our copy of Close
          </h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            The month so far: how many first calls were booked, and how many of
            those people showed, qualified and bought. Every number is counted
            from our own hourly copy of Close, and each one says who it counted.
            Nothing here is taken from another dashboard.
          </p>
        </div>

        <dl className="divide-ui-line border-ui-line mt-3 grid divide-y border-t sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0">
          {funnel.stages.map((stage) => (
            <div key={stage.key} className="px-4 py-3.5">
              <dt className={adminEyebrowClass}>{stage.label}</dt>
              <dd className="text-ui-text mt-2 text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {stage.count.toLocaleString("en-US")}
                {stage.ofBookedPct === null ? null : (
                  <span className="text-ui-text-muted ml-2 text-sm font-normal">
                    {stage.ofBookedPct}% of booked
                  </span>
                )}
              </dd>
              <dd className="text-ui-text-muted mt-1.5 text-xs">
                {stage.population}
              </dd>
              <dd className="text-ui-text-subtle mt-1 text-xs">
                {stage.source}
              </dd>
            </div>
          ))}
        </dl>

        <div className="text-ui-text-subtle space-y-1 px-4 py-3 text-xs">
          <p>
            Revenue on the {funnel.won} won{" "}
            {funnel.won === 1 ? "deal" : "deals"}: {money(funnel.revenue)}.
            {funnel.unvalued > 0
              ? ` ${funnel.unvalued} of them ${funnel.unvalued === 1 ? "carries" : "carry"} no value in Close and ${funnel.unvalued === 1 ? "is" : "are"} left out of that figure.`
              : null}
          </p>
          {funnel.qualifiedWithoutShow > 0 ? (
            <p>
              {funnel.qualifiedWithoutShow} booked{" "}
              {funnel.qualifiedWithoutShow === 1 ? "call is" : "calls are"}{" "}
              marked qualified with no show logged, so Qualified can include
              people not in Showed. That is why both rates are out of booked.
            </p>
          ) : null}
          {funnel.excluded > 0 ? (
            <p>
              {funnel.excluded} first{" "}
              {funnel.excluded === 1 ? "call is" : "calls are"} left out because
              the lead is now Canceled (by Lead) or Outside the US, or in the
              LTF Quiz Funnel. SteelTrap leaves the same calls out.
            </p>
          ) : null}
        </div>
      </section>

      <section
        className={adminPanelClass}
        aria-label="Marketing versus scrapers"
      >
        <div className="px-4 pt-4">
          <h2 className={adminSectionTitleClass}>
            Marketing, and the sales floor&apos;s own rebooking
          </h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            {SCRAPER_FUNNEL} is the sales floor calling and rebooking its own
            list. It is split out so ad spend is never divided by calls the ads
            did not buy. The marketing line is what Kody&apos;s scorecard row
            &ldquo;Marketing Meetings Booked&rdquo; counts.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-ui-canvas text-ui-text-muted text-xs">
              <tr>
                <th scope="col" className={TH_LEFT}>
                  Who
                </th>
                <th scope="col" className={TH}>
                  Booked
                </th>
                <th scope="col" className={TH}>
                  Showed
                </th>
                <th scope="col" className={TH}>
                  Show rate
                </th>
                <th scope="col" className={TH}>
                  Qualified
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Marketing (everything else)", ...funnel.marketing },
                { label: SCRAPER_FUNNEL, ...funnel.scrapers },
              ].map((row) => (
                <tr key={row.label} className="border-ui-line/60 border-t">
                  <th scope="row" className={TD_LEFT}>
                    {row.label}
                  </th>
                  <td className={TD}>{row.booked}</td>
                  <td className={TD}>{row.showed}</td>
                  <td className={`${TD} text-ui-text-subtle`}>
                    {rate(row.showed, row.booked)}
                  </td>
                  <td className={TD}>{row.qualified}</td>
                </tr>
              ))}
              <tr className="border-ui-line border-t font-semibold">
                <th scope="row" className={TD_LEFT}>
                  Every first call
                </th>
                <td className={TD}>
                  {funnel.marketing.booked + funnel.scrapers.booked}
                </td>
                <td className={TD}>
                  {funnel.marketing.showed + funnel.scrapers.showed}
                </td>
                <td className={`${TD} text-ui-text-subtle`}>
                  {rate(
                    funnel.marketing.showed + funnel.scrapers.showed,
                    funnel.marketing.booked + funnel.scrapers.booked,
                  )}
                </td>
                <td className={TD}>
                  {funnel.marketing.qualified + funnel.scrapers.qualified}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={adminPanelClass} aria-label="Month to date by funnel">
        <div className="px-4 pt-4">
          <h2 className={adminSectionTitleClass}>By Close funnel</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Show rate is showed out of booked. Showed and Qualified count only
            calls a rep logged as Yes, so they are a minimum.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-ui-canvas text-ui-text-muted text-xs">
              <tr>
                <th scope="col" className={TH_LEFT}>
                  Funnel (Close)
                </th>
                <th scope="col" className={TH}>
                  Booked
                </th>
                <th scope="col" className={TH}>
                  Showed
                </th>
                <th scope="col" className={TH}>
                  Show rate
                </th>
                <th scope="col" className={TH}>
                  Qualified
                </th>
              </tr>
            </thead>
            <tbody>
              {funnel.rows.map((row) => (
                <tr key={row.label} className="border-ui-line/60 border-t">
                  <th scope="row" className={TD_LEFT}>
                    <span className="inline-flex items-center gap-1.5">
                      <ChannelLogo label={row.label} />
                      {row.label}
                    </span>
                  </th>
                  <td className={TD}>{row.booked}</td>
                  <td className={TD}>{row.showed}</td>
                  <td className={`${TD} text-ui-text-subtle`}>
                    {rate(row.showed, row.booked)}
                  </td>
                  <td className={TD}>{row.qualified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={adminPanelClass}
        aria-label="How this differs from the MTD dashboard"
      >
        <div className="space-y-2 px-4 py-4 text-xs">
          <h2 className={adminSectionTitleClass}>
            Where this will disagree with the MTD (month-to-date) funnel
            dashboard
          </h2>
          <p className="text-ui-text-subtle">
            Both read Close and both count one booking per lead, so they have
            stayed within about 2% of each other on the same weeks. They follow
            different rules, and these are the differences:
          </p>
          <ul className="text-ui-text-subtle list-disc space-y-1 pl-5">
            <li>
              <strong>Meeting owners.</strong> That dashboard drops meetings
              owned by four people, one of whom is an active VP setter. Our copy
              of Close has no meeting-owner field, so that filter cannot be
              applied here. Those meetings are counted above.
            </li>
            <li>
              <strong>What a booking is.</strong> We read the lead&apos;s
              &ldquo;First Sales Call Booked Date&rdquo;. That dashboard reads
              Close meeting activities and filters them by title.
            </li>
            <li>
              <strong>Its Leads column is left out on purpose.</strong> It read
              365 for a week with 809 webinar registrants. Acquisition numbers
              belong on the other tabs.
            </li>
          </ul>
          {report.mirrorSyncedAt ? (
            <p className="text-ui-text-subtle">
              First calls last copied from Close at{" "}
              {new Date(report.mirrorSyncedAt).toLocaleString("en-US", {
                timeZone: "America/New_York",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              ET (every hour). Won deals are read from Close directly.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
