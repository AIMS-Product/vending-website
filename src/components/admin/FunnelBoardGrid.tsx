import {
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type { BoardGroup, FunnelBoard } from "@/lib/services/funnel-board";

interface FunnelBoardGridProps {
  board: FunnelBoard;
  today: string;
}

const TH = "px-2 py-2 text-center font-semibold whitespace-nowrap";
const TD = "px-2 py-1.5 text-center tabular-nums whitespace-nowrap";
const STICKY = "sticky left-0 z-10 bg-ui-surface";

const DOW = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const MD = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});
const at = (day: string) => new Date(`${day}T12:00:00Z`);

function dayClass(day: string, today: string): string {
  if (day === today) return "bg-ui-accent/10";
  return day > today ? "text-ui-text-subtle" : "";
}

function Count({ n }: { n: number }) {
  return n ? <>{n}</> : <span className="text-ui-text-subtle">–</span>;
}

/** Ours minus Close's, signed, quiet when equal. */
function Diff({ ours, close }: { ours: number; close: number }) {
  const d = ours - close;
  if (d === 0) return <span className="text-ui-text-subtle">=</span>;
  return (
    <span
      className={
        d > 0 ? "text-ui-ok-ink font-semibold" : "text-ui-bad-ink font-semibold"
      }
    >
      {d > 0 ? `+${d}` : d}
    </span>
  );
}

export function FunnelBoardGrid({ board, today }: FunnelBoardGridProps) {
  return (
    <section className={adminPanelClass} aria-label="Funnel details">
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>Funnel details</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Every first sales call in Close, on the day it is scheduled for: the
          same calls as the sales sheet, so the totals match. The difference is
          the credit. A call whose lead filled a form on vendingpreneurs.com
          counts for the channel that brought them to the site; a call with no
          site form keeps its Close funnel. <strong>Close says</strong> is what
          Close&apos;s funnel field puts on that row. {board.moved} of{" "}
          {board.total} calls move.
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="text-ui-text-muted text-xs">
            <tr>
              <th
                scope="col"
                className={`${STICKY} px-4 py-2 text-left font-semibold`}
              >
                Channel
              </th>
              {board.days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className={`${TH} ${dayClass(day, today)}`}
                >
                  <div>{day === today ? "Today" : DOW.format(at(day))}</div>
                  <div className="font-normal">{MD.format(at(day))}</div>
                </th>
              ))}
              <th scope="col" className={TH}>
                Total
              </th>
              <th scope="col" className={TH}>
                Close says
              </th>
              <th scope="col" className={TH}>
                Diff
              </th>
            </tr>
          </thead>
          <tbody>
            {board.groups.map((group) => (
              <GroupRows
                key={group.group}
                group={group}
                today={today}
                days={board.days}
              />
            ))}
            <tr className="border-ui-line border-t-2 font-semibold">
              <th scope="row" className={`${STICKY} px-4 py-2 text-left`}>
                TOTAL
              </th>
              {board.dayTotals.map((n, i) => (
                <td
                  key={board.days[i]}
                  className={`${TD} ${dayClass(board.days[i]!, today)}`}
                >
                  {n}
                </td>
              ))}
              <td className={TD}>{board.total}</td>
              <td className={TD}>{board.total}</td>
              <td className={TD}>
                <Diff ours={board.total} close={board.total} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupRows({
  group,
  today,
  days,
}: {
  group: BoardGroup;
  today: string;
  days: string[];
}) {
  const closeTotal = group.rows.reduce((sum, row) => sum + row.closeTotal, 0);
  return (
    <>
      <tr className="border-ui-line bg-ui-canvas border-t text-xs font-semibold tracking-wide uppercase">
        <th
          scope="rowgroup"
          className={`${STICKY} bg-ui-canvas px-4 py-1.5 text-left`}
        >
          {group.group}
        </th>
        {group.days.map((n, i) => (
          <td key={days[i]} className={`${TD} ${dayClass(days[i]!, today)}`}>
            <Count n={n} />
          </td>
        ))}
        <td className={TD}>{group.total}</td>
        <td className={TD}>{closeTotal}</td>
        <td className={TD}>
          <Diff ours={group.total} close={closeTotal} />
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.channel} className="border-ui-line/60 border-t">
          <th
            scope="row"
            className={`${STICKY} px-4 py-1.5 text-left font-normal`}
          >
            <span className="inline-flex items-center gap-2">
              <ChannelLogo label={row.channel} />
              {row.channel}
            </span>
          </th>
          {row.days.map((n, i) => (
            <td key={days[i]} className={`${TD} ${dayClass(days[i]!, today)}`}>
              <Count n={n} />
            </td>
          ))}
          <td className={`${TD} font-semibold`}>{row.total}</td>
          <td className={`${TD} text-ui-text-muted`}>{row.closeTotal}</td>
          <td className={TD}>
            <Diff ours={row.total} close={row.closeTotal} />
          </td>
        </tr>
      ))}
    </>
  );
}
