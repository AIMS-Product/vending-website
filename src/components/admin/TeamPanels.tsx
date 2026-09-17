import {
  AdminStatusBadge,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type { RepRole } from "@/lib/services/call-credit";
import {
  ATTENDANCE_TARGET_PCT,
  IG_POSTS_PER_WEEK_TARGET,
  OFFER_TARGET_PCT,
  rateOf,
  type AdsCampaign,
  type AdsReport,
  type CloserRow,
  type ClosersReport,
  type PersonRow,
  type SettersReport,
  type SocialsReport,
  type WebinarRow,
  type WebinarsReport,
  type WeekRow,
} from "@/lib/services/team-report";

/**
 * Five tables, one visual language. Every cell is a number or a dash; a dash
 * is "not observed", never zero. Rates are only shown where both sides were
 * observed, and a rate that would exceed 100% is a dash.
 */

const DASH = (
  <span className="text-ui-text-subtle" title="Not observed">
    —
  </span>
);

function num(value: number | null | undefined): React.ReactNode {
  if (value == null) return DASH;
  return value.toLocaleString("en-US");
}

function money(value: number | null | undefined): React.ReactNode {
  if (value == null) return DASH;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

/** A rate with its two sides on hover, so the number can be argued with. */
function Rate({
  numerator,
  denominator,
  of,
}: {
  numerator: number;
  denominator: number;
  of: string;
}) {
  const value = rateOf(numerator, denominator);
  if (value == null) return DASH;
  return <span title={`${numerator} of ${denominator} ${of}`}>{value}%</span>;
}

const ROLE_LABEL: Record<RepRole, string> = {
  setter: "Setter",
  scraper: "Scraper",
  setter_closer: "Setter / closer",
  not_setter: "Not a setter",
  unclassified: "Unclassified",
};
const ROLE_TONE: Record<RepRole, "ok" | "warn" | "idle"> = {
  setter: "ok",
  scraper: "ok",
  setter_closer: "ok",
  not_setter: "warn",
  unclassified: "idle",
};

const TH = "px-3 py-2.5 text-right font-semibold whitespace-nowrap";
const TH_LEFT = "px-4 py-2.5 text-left font-semibold whitespace-nowrap";
const TD = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap";
const TD_MUTED = `${TD} text-ui-text-muted`;
const THEAD =
  "bg-ui-canvas text-ui-text-subtle text-[0.6875rem] font-semibold tracking-[0.06em] uppercase";

function Panel({
  title,
  note,
  children,
  footer,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className={adminPanelClass} aria-label={title}>
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={adminSectionTitleClass}>{title}</h2>
        <p className="text-ui-text-subtle max-w-2xl text-xs">{note}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="text-ui-text-muted border-ui-line space-y-1 border-t px-4 py-3 text-xs">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-ui-text-subtle px-4 py-6 text-sm">{children}</p>;
}

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

export function SettersTable({
  report,
  connected,
}: {
  report: SettersReport;
  connected: boolean;
}) {
  const rows = [...report.rows, report.selfBooked];
  return (
    <Panel
      title="Setters and scrapers"
      note="Setters and scrapers both book Lane 2 calls; the Role column says which job each person holds, from the Lane 2 roster. Booked is a Close first sales call booked in the period. Set adds the calls a person booked that Close does not hold as a first call. Recorded means Calendly or Close named them; tagged means their own booking link; inferred means the last rep to call or text before the booking."
      footer={
        <>
          {report.target != null ? (
            <p>
              Reactivation target for the period:{" "}
              <span className="text-ui-text font-semibold tabular-nums">
                {report.target.toLocaleString()}
              </span>{" "}
              booked calls, against{" "}
              <span className="text-ui-text font-semibold tabular-nums">
                {report.total.booked.toLocaleString()}
              </span>{" "}
              credited to a setter or scraper.
            </p>
          ) : null}
          {report.unclassified.length > 0 ? (
            <p>
              On neither roster list, so shown without a role:{" "}
              {report.unclassified.join(", ")}. Add them to the roster in
              call-credit.ts to settle it.
            </p>
          ) : null}
          <p>
            Close ranks setter evidence as Calendly&apos;s record, then a tagged
            link, then Close&apos;s setter field, then an inferred touch. Show,
            close and won are read from the Close lead. Close means Contract
            Sent or Closed / Won.
          </p>
        </>
      }
    >
      {!connected ? (
        <Empty>
          The Close mirror could not be read, so nothing here is observed.
        </Empty>
      ) : rows.length === 1 && report.total.set === 0 ? (
        <Empty>No calls were booked in this period.</Empty>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className={THEAD}>
              <th className={TH_LEFT}>Who</th>
              <th className={TH}>Set</th>
              <th className={TH}>Recorded</th>
              <th className={TH}>Tagged</th>
              <th className={TH}>Inferred</th>
              <th className={TH}>Booked</th>
              <th className={TH}>Show</th>
              <th className={TH}>Show rate</th>
              <th className={TH}>Close</th>
              <th className={TH}>Won</th>
              <th className={TH}>Outcome logged</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {rows.map((row) => (
              <PersonTableRow key={row.who} row={row} />
            ))}
            <PersonTableRow row={report.total} total />
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function PersonTableRow({
  row,
  total = false,
}: {
  row: PersonRow;
  total?: boolean;
}) {
  const weight = total ? "font-semibold" : "";
  const isSelf =
    !total && row.set > 0 && row.recorded + row.tagged + row.inferred === 0;
  return (
    <tr className={total ? "bg-ui-canvas" : "hover:bg-ui-canvas"}>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-ui-text ${weight}`}>{row.who}</span>
          {total || isSelf ? null : (
            <AdminStatusBadge
              status={row.role}
              label={ROLE_LABEL[row.role]}
              tone={ROLE_TONE[row.role]}
            />
          )}
        </div>
      </td>
      <td className={`${TD} ${weight}`}>{num(row.set)}</td>
      <td className={TD_MUTED}>{isSelf ? DASH : num(row.recorded)}</td>
      <td className={TD_MUTED}>{isSelf ? DASH : num(row.tagged)}</td>
      <td className={TD_MUTED}>{isSelf ? DASH : num(row.inferred)}</td>
      <td className={`${TD} ${weight}`}>{num(row.booked)}</td>
      <td className={TD}>{num(row.showed)}</td>
      <td className={TD}>
        <Rate
          numerator={row.showed}
          denominator={row.showKnown}
          of="with a show-up answer showed"
        />
      </td>
      <td className={TD}>{num(row.closed)}</td>
      <td className={`${TD} ${weight}`}>{num(row.won)}</td>
      <td className={TD_MUTED}>
        <Rate
          numerator={row.showKnown}
          denominator={row.booked}
          of="booked calls have a show-up answer in Close"
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Closers
// ---------------------------------------------------------------------------

export function ClosersTable({
  report,
  connected,
}: {
  report: ClosersReport;
  connected: boolean;
}) {
  return (
    <Panel
      title="Closers"
      note="First calls on each person's Calendly calendar, by the day the call happens, cancellations included. Onboarding, Next Steps, Follow-Up and Rescheduled calendars are not first calls. Show, close and won come from the Close lead with the same email."
      footer={
        <>
          <p>
            Matched is how many of the calendar&apos;s calls have a Close
            first-call record behind them; outcomes can only be read for those.
          </p>
          <p>
            The last row is Close first calls booked in the period with no
            Calendly booking anywhere: calendars in the other Calendly
            organization, or calls set straight in Close.
          </p>
        </>
      }
    >
      {!connected ? (
        <Empty>
          The Close mirror could not be read, so no outcomes are observed.
        </Empty>
      ) : report.rows.length === 0 && report.noHost.booked === 0 ? (
        <Empty>No first calls landed in this period.</Empty>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className={THEAD}>
              <th className={TH_LEFT}>Closer</th>
              <th className={TH}>Booked</th>
              <th className={TH}>Canceled</th>
              <th className={TH}>Matched</th>
              <th className={TH}>Show</th>
              <th className={TH}>Show rate</th>
              <th className={TH}>Close</th>
              <th className={TH}>Won</th>
              <th className={TH}>Won of shown</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.rows.map((row) => (
              <CloserTableRow key={row.who} row={row} />
            ))}
            <CloserTableRow row={report.noHost} muted />
            <CloserTableRow row={report.total} total />
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function CloserTableRow({
  row,
  total = false,
  muted = false,
}: {
  row: CloserRow;
  total?: boolean;
  muted?: boolean;
}) {
  const weight = total ? "font-semibold" : "";
  return (
    <tr className={total ? "bg-ui-canvas" : "hover:bg-ui-canvas"}>
      <td
        className={`px-4 py-2.5 ${muted ? "text-ui-text-muted" : "text-ui-text"} ${weight}`}
      >
        {row.who}
      </td>
      <td className={`${TD} ${weight}`}>{num(row.booked)}</td>
      <td className={TD_MUTED}>{num(row.canceled)}</td>
      <td className={TD_MUTED}>{muted ? DASH : num(row.matched)}</td>
      <td className={TD}>{num(row.showed)}</td>
      <td className={TD}>
        <Rate
          numerator={row.showed}
          denominator={row.showKnown}
          of="with a show-up answer showed"
        />
      </td>
      <td className={TD}>{num(row.closed)}</td>
      <td className={`${TD} ${weight}`}>{num(row.won)}</td>
      <td className={TD}>
        <Rate
          numerator={row.won}
          denominator={row.showed}
          of="shown calls were won"
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Webinars
// ---------------------------------------------------------------------------

export function WebinarsTable({ report }: { report: WebinarsReport }) {
  return (
    <Panel
      title="Webinars"
      note={`Attendance target ${ATTENDANCE_TARGET_PCT}% of registrations; ${OFFER_TARGET_PCT}% of attendees still there at the offer. Spend is every Webinar-channel ad dollar from the day after the previous webinar through this one.`}
      footer={
        <p>
          Booked is the count of record: rows on the Booked Calls sheet
          (booked_calls). Close&apos;s tag cohort is a different population
          because the event tag goes missing on the people who book, so it is
          not used here. A dash means the column has not reached production yet,
          so cost per booked is not observed either.
        </p>
      }
    >
      {report.rows.length === 0 ? (
        <Empty>No webinar ran in this period.</Empty>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className={THEAD}>
              <th className={TH_LEFT}>Webinar</th>
              <th className={TH}>Registrations</th>
              <th className={TH}>Attendees</th>
              <th className={TH}>Attendance</th>
              <th className={TH}>At offer</th>
              <th className={TH}>At offer rate</th>
              <th className={TH}>Booked</th>
              <th className={TH}>Shown</th>
              <th className={TH}>Won</th>
              <th className={TH}>Spend</th>
              <th className={TH}>Cost / registration</th>
              <th className={TH}>Cost / booked</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.rows.map((row) => (
              <WebinarTableRow key={row.date} row={row} />
            ))}
            {report.total ? <WebinarTableRow row={report.total} total /> : null}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function TargetPercent({
  value,
  target,
}: {
  value: number | null;
  target: number;
}) {
  if (value == null) return DASH;
  return (
    <AdminStatusBadge
      status={value >= target ? "ok" : "bad"}
      label={`${value}%`}
      tone={value >= target ? "ok" : "bad"}
    />
  );
}

function WebinarTableRow({
  row,
  total = false,
}: {
  row: WebinarRow;
  total?: boolean;
}) {
  const weight = total ? "font-semibold" : "";
  return (
    <tr className={total ? "bg-ui-canvas" : "hover:bg-ui-canvas"}>
      <td className="px-4 py-2.5">
        <div className={`text-ui-text ${weight}`}>{row.label}</div>
        {total ? null : (
          <div className="text-ui-text-subtle text-xs">
            {row.date} · {row.format}
          </div>
        )}
      </td>
      <td className={`${TD} ${weight}`}>{num(row.registrations)}</td>
      <td className={TD}>{num(row.attendees)}</td>
      <td className={TD}>
        <TargetPercent
          value={row.attendanceRate}
          target={ATTENDANCE_TARGET_PCT}
        />
      </td>
      <td className={TD}>{num(row.attendeesAtOffer)}</td>
      <td className={TD}>
        <TargetPercent value={row.offerRate} target={OFFER_TARGET_PCT} />
      </td>
      <td className={`${TD} ${weight}`}>{num(row.booked)}</td>
      <td className={TD}>{num(row.showed)}</td>
      <td className={TD}>{num(row.won)}</td>
      <td
        className={TD}
        title={`Webinar-channel spend ${row.spendFrom} to ${row.date || "period end"}`}
      >
        {money(row.spend)}
      </td>
      <td className={TD_MUTED}>{money(row.costPerRegistration)}</td>
      <td className={TD_MUTED}>{money(row.costPerBooked)}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Socials
// ---------------------------------------------------------------------------

export function SocialsTable({ report }: { report: SocialsReport }) {
  return (
    <Panel
      title="Socials"
      note={`Posts published per Monday-to-Sunday week, from Metricool. Instagram is held to ${IG_POSTS_PER_WEEK_TARGET} posts a week per account; a week still in progress is not judged. YouTube views are daily video views summed over the week.`}
      footer={
        <p>
          A week that crosses a month edge is counted whole, so the first and
          last rows may include a few days outside the period. Metricool&apos;s
          YouTube history starts 2026-06-29 and lags about four days.
        </p>
      }
    >
      {report.weeks.length === 0 ? (
        <Empty>No weeks in this period.</Empty>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className={THEAD}>
              <th className={TH_LEFT}>Week of</th>
              <th className={TH}>
                <span className="inline-flex items-center gap-1.5">
                  <ChannelLogo label="Instagram" /> Mike
                </span>
              </th>
              <th className={TH}>
                <span className="inline-flex items-center gap-1.5">
                  <ChannelLogo label="Instagram" /> Anthony
                </span>
              </th>
              <th className={TH}>
                <span className="inline-flex items-center gap-1.5">
                  <ChannelLogo label="Facebook" /> Facebook
                </span>
              </th>
              <th className={TH}>
                <span className="inline-flex items-center gap-1.5">
                  <ChannelLogo label="LinkedIn" /> LinkedIn
                </span>
              </th>
              <th className={TH}>
                <span className="inline-flex items-center gap-1.5">
                  <ChannelLogo label="X" /> X
                </span>
              </th>
              <th className={TH}>
                <span className="inline-flex items-center gap-1.5">
                  <ChannelLogo label="YouTube" /> Uploads
                </span>
              </th>
              <th className={TH}>YouTube views</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.weeks.map((week) => (
              <WeekTableRow key={week.start} week={week} />
            ))}
            <WeekTableRow week={report.total} total />
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function IgCell({ count, complete }: { count: number; complete: boolean }) {
  if (!complete) {
    return (
      <span className="text-ui-text-muted" title="Week still in progress">
        {count}
      </span>
    );
  }
  const ok = count >= IG_POSTS_PER_WEEK_TARGET;
  return (
    <AdminStatusBadge
      status={ok ? "ok" : "bad"}
      label={String(count)}
      tone={ok ? "ok" : "bad"}
    />
  );
}

function WeekTableRow({
  week,
  total = false,
}: {
  week: WeekRow;
  total?: boolean;
}) {
  const weight = total ? "font-semibold" : "";
  return (
    <tr className={total ? "bg-ui-canvas" : "hover:bg-ui-canvas"}>
      <td className={`text-ui-text px-4 py-2.5 whitespace-nowrap ${weight}`}>
        {total ? "Period total" : `${week.start} to ${week.end}`}
        {!total && !week.complete ? (
          <span className="text-ui-text-subtle ml-2 text-xs">in progress</span>
        ) : null}
      </td>
      <td className={TD}>
        {total ? (
          num(week.igMike)
        ) : (
          <IgCell count={week.igMike} complete={week.complete} />
        )}
      </td>
      <td className={TD}>
        {total ? (
          num(week.igAnthony)
        ) : (
          <IgCell count={week.igAnthony} complete={week.complete} />
        )}
      </td>
      <td className={TD}>{num(week.facebook)}</td>
      <td className={TD}>{num(week.linkedin)}</td>
      <td className={TD}>{num(week.x)}</td>
      <td className={TD}>{num(week.youtubeUploads)}</td>
      <td className={`${TD} ${weight}`}>{num(week.youtubeViews)}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

export function AdsTable({
  report,
  connected,
}: {
  report: AdsReport;
  connected: boolean;
}) {
  return (
    <Panel
      title="Ads"
      note="Spend, leads and booked per campaign from the channel spine. Google keys spend and leads by the same campaign id, so its campaign rows carry a real cost per lead. Meta keys spend by its campaign id and leads by the link's utm tag, so Meta's cost per lead is only honest on the channel line."
      footer={
        <p>
          Booked here is a lead-linked booking on the spine, not the Close
          first-call basis the goals page uses. Spend comes from Metricool
          daily; leads from GHL forms and the site.
        </p>
      }
    >
      {!connected ? (
        <Empty>The channel spine could not be read.</Empty>
      ) : report.channels.length === 0 ? (
        <Empty>No paid spend or paid leads were observed in this period.</Empty>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className={THEAD}>
              <th className={TH_LEFT}>Campaign</th>
              <th className={TH}>Spend</th>
              <th className={TH}>Impressions</th>
              <th className={TH}>Clicks</th>
              <th className={TH}>Leads</th>
              <th className={TH}>Cost / lead</th>
              <th className={TH}>Booked</th>
              <th className={TH}>Cost / booked</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {report.channels.map((channel) => (
              <ChannelRows key={channel.channel} channel={channel} />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function ChannelRows({ channel }: { channel: AdsReport["channels"][number] }) {
  return (
    <>
      <tr className="bg-ui-canvas">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ChannelLogo label={channel.channel} />
            <span className="text-ui-text font-semibold">
              {channel.channel}
            </span>
            <span className="text-ui-text-subtle text-xs">
              {channel.campaigns.length}{" "}
              {channel.campaigns.length === 1 ? "campaign" : "campaigns"}
            </span>
          </div>
        </td>
        <AdsCells row={channel} bold />
      </tr>
      {channel.campaigns.map((campaign) => (
        <tr key={campaign.key} className="hover:bg-ui-canvas">
          <td className="text-ui-text px-4 py-2.5 pl-10" title={campaign.key}>
            {campaign.label}
          </td>
          <AdsCells row={campaign} />
        </tr>
      ))}
    </>
  );
}

function AdsCells({ row, bold = false }: { row: AdsCampaign; bold?: boolean }) {
  const weight = bold ? "font-semibold" : "";
  return (
    <>
      <td className={`${TD} ${weight}`}>{money(row.spend)}</td>
      <td className={TD_MUTED}>{num(row.impressions)}</td>
      <td className={TD_MUTED}>{num(row.clicks)}</td>
      <td className={`${TD} ${weight}`}>{num(row.leads)}</td>
      <td className={TD}>{money(row.costPerLead)}</td>
      <td className={`${TD} ${weight}`}>{num(row.booked)}</td>
      <td className={TD}>{money(row.costPerBooked)}</td>
    </>
  );
}
