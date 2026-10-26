import {
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import type { MarketingCredit } from "@/lib/services/marketing-credit-data";
import { SURFACES } from "@/lib/services/self-booked";

type Loaded = Extract<MarketingCredit, { ok: true }>;

const TH = "px-4 py-2.5 text-right font-semibold whitespace-nowrap";
const TD = "px-4 py-2 text-right tabular-nums whitespace-nowrap";
const ROW_TH = "px-4 py-2 text-left font-medium whitespace-nowrap";

const n = (value: number) => value.toLocaleString("en-US");
const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className={adminPanelClass} aria-label={title}>
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>{title}</h2>
        <p className="text-ui-text-subtle mt-1 max-w-3xl text-xs">{note}</p>
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-ui-text-muted text-xs">{label}</p>
      <p className="text-ui-text mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {sub ? <p className="text-ui-text-subtle mt-0.5 text-xs">{sub}</p> : null}
    </div>
  );
}

export function MarketingCreditPanel({ report }: { report: Loaded }) {
  const { credit, siteForms, chat, selfBooked, reactivation } = report;
  const total = credit.reduce(
    (t, r) => ({
      booked: t.booked + r.booked,
      themselves: t.themselves + r.themselves,
      bySetter: t.bySetter + r.bySetter,
      won: t.won + r.won,
      revenue: t.revenue + r.revenue,
    }),
    { booked: 0, themselves: 0, bySetter: 0, won: 0, revenue: 0 },
  );
  const setterBooked = siteForms.bookedBySetter.reduce(
    (s, r) => s + r.count,
    0,
  );
  const notBooked = siteForms.notBooked.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-5">
      <p className="text-ui-text-muted text-sm">
        {report.from} to {report.to}. Which first calls and wins marketing
        started, and who finished the booking: the person on their own, or a
        setter after marketing had already warmed them up.
      </p>

      <section
        className={`${adminPanelClass} divide-ui-line/60 grid grid-cols-2 divide-x md:grid-cols-4`}
        aria-label="Headline"
      >
        <Stat
          label="Booked themselves through marketing"
          value={n(selfBooked.total)}
          sub="Calendly first calls, setter and DM links left out"
        />
        <Stat
          label="Booked calls marketing started"
          value={n(total.booked - (credit.at(-1)?.booked ?? 0))}
          sub={`of ${n(total.booked)} first calls`}
        />
        <Stat
          label="Reactivation calls marketing warmed"
          value={`${n(reactivation.assistedCalls)} of ${n(reactivation.calls)}`}
          sub={pct(reactivation.assistedCalls, reactivation.calls)}
        />
        <Stat
          label="Reactivation wins marketing warmed"
          value={`${n(reactivation.assistedWins)} of ${n(reactivation.wins)}`}
          sub={usd(reactivation.assistedRevenue)}
        />
      </section>

      <Section
        title="First calls by where the person came from"
        note="Every first sales call booked this month (Close First Sales Call Booked Date). Source is Close's Entry Source, else a site form or chat on or before the booked day. 'By a setter' = Reactivation Scrapers, a Lane 2 or Social DMs booking, or a setter named on the lead. Wins are deals won this month, by the same source."
      >
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-ui-canvas text-ui-text-muted text-xs">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                Came from
              </th>
              <th scope="col" className={TH}>
                Booked
              </th>
              <th scope="col" className={TH}>
                Booked themselves
              </th>
              <th scope="col" className={TH}>
                Booked by a setter
              </th>
              <th scope="col" className={TH}>
                Won
              </th>
              <th scope="col" className={TH}>
                Revenue
              </th>
            </tr>
          </thead>
          <tbody>
            {credit.map((row) => (
              <tr key={row.source} className="border-ui-line/60 border-t">
                <th scope="row" className={ROW_TH}>
                  {row.source}
                </th>
                <td className={TD}>{n(row.booked)}</td>
                <td className={TD}>{n(row.themselves)}</td>
                <td className={TD}>{n(row.bySetter)}</td>
                <td className={TD}>{n(row.won)}</td>
                <td className={TD}>{usd(row.revenue)}</td>
              </tr>
            ))}
            <tr className="border-ui-line-strong border-t-2 font-semibold">
              <th scope="row" className={ROW_TH}>
                Total
              </th>
              <td className={TD}>{n(total.booked)}</td>
              <td className={TD}>{n(total.themselves)}</td>
              <td className={TD}>{n(total.bySetter)}</td>
              <td className={TD}>{n(total.won)}</td>
              <td className={TD}>{usd(total.revenue)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section
        title="Site form fills"
        note="People (one per email) who filled a site form this month. 'Not booked' is grouped by their current Close status; 'New' means the status was never moved, not proof nobody called."
      >
        <div className="grid gap-5 px-4 pb-4 md:grid-cols-3">
          <div>
            <p className="text-ui-text-muted text-xs">Filled a form</p>
            <p className="text-2xl font-semibold tabular-nums">
              {n(siteForms.filled)}
            </p>
            <p className="text-ui-text-muted mt-3 text-xs">Booked themselves</p>
            <p className="text-xl font-semibold tabular-nums">
              {n(siteForms.bookedThemselves)}{" "}
              <span className="text-ui-text-subtle text-xs font-normal">
                {pct(siteForms.bookedThemselves, siteForms.filled)}
              </span>
            </p>
          </div>
          <List
            title={`Booked by a setter: ${n(setterBooked)} (${pct(setterBooked, siteForms.filled)})`}
            rows={siteForms.bookedBySetter.map((r) => [r.setter, r.count])}
          />
          <List
            title={`Not booked yet: ${n(notBooked)} (${pct(notBooked, siteForms.filled)})`}
            rows={siteForms.notBooked.map((r) => [r.status, r.count])}
          />
        </div>
      </Section>

      <Section
        title="Site chatbot"
        note="Chats of two or more messages this month. 'Later' = the chat's lead booked outside the chat, on their own or through a setter."
      >
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-ui-canvas text-ui-text-muted text-xs">
            <tr>
              {[
                "Chats",
                "Gave email",
                "Booked in chat",
                "Booked later themselves",
                "Booked later by a setter",
              ].map((h) => (
                <th key={h} scope="col" className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-ui-line/60 border-t">
              <td className={TD}>{n(chat.chats)}</td>
              <td className={TD}>{n(chat.gaveEmail)}</td>
              <td className={TD}>{n(chat.bookedInChat)}</td>
              <td className={TD}>{n(chat.bookedLaterThemselves)}</td>
              <td className={TD}>{n(chat.bookedLaterBySetter)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section
        title="Booked themselves, by surface"
        note="New-class Calendly first calls the person booked on our calendar this month, one per person. Follow-up email = the no-book emails (utm_content nbf-)."
      >
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-ui-canvas text-ui-text-muted text-xs">
            <tr>
              {SURFACES.map((s) => (
                <th key={s} scope="col" className={TH}>
                  {s}
                </th>
              ))}
              <th scope="col" className={TH}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-ui-line/60 border-t">
              {SURFACES.map((s) => (
                <td key={s} className={TD}>
                  {n(selfBooked.bySurface[s])}
                </td>
              ))}
              <td className={`${TD} font-semibold`}>{n(selfBooked.total)}</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function List({
  title,
  rows,
}: {
  title: string;
  rows: ReadonlyArray<readonly [string, number]>;
}) {
  return (
    <div>
      <p className="text-ui-text-muted text-xs">{title}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.length === 0 ? (
          <li className="text-ui-text-subtle">None</li>
        ) : null}
        {rows.map(([label, count]) => (
          <li key={label} className="flex justify-between gap-4">
            <span>{label}</span>
            <span className="tabular-nums">{n(count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
