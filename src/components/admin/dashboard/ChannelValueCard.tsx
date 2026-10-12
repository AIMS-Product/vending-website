import type { ReactNode } from "react";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { adminEyebrowClass } from "@/components/admin/AdminUi";
import {
  CardMessage,
  DashboardCard,
  failed,
  money,
  num,
} from "@/components/admin/dashboard/DashboardPanels";
import { buildChannelFlow } from "@/lib/analytics/channel-flow";
import {
  SMALL_SAMPLE,
  buildChannelValue,
  spendByFlowChannel,
} from "@/lib/analytics/channel-value";
import { capturedByChannel, inRange } from "@/lib/analytics/dashboard-metrics";
import {
  type DashboardWindow,
  windowPhrase,
} from "@/lib/analytics/dashboard-window";
import {
  callSpan,
  readCalls,
  readDeals,
  readFacts,
} from "@/lib/services/analytics-dashboard-data";

const COLUMNS = [
  "Spend",
  "Booked",
  "Show rate",
  "Close rate",
  "Revenue won",
  "Cost per booked call",
  "Cost per won deal",
  "Revenue per $1 spent",
] as const;

const dash = (n: number | null, format: (n: number) => string) =>
  n === null ? "–" : format(n);
const pct = (n: number) => `${n}%`;
const perDollar = (n: number) => `$${n.toFixed(2)}`;

function Cell({ children }: { children: ReactNode }) {
  return <td className="py-2.5 pr-3 text-right tabular-nums">{children}</td>;
}

/**
 * The flow card's cohort priced: the same reads (cached per request), so
 * booked, won and revenue here are the flow chart's numbers exactly.
 */
export async function ChannelValueCard({
  window,
}: {
  window: DashboardWindow;
}) {
  const span = callSpan(window);
  const [calls, facts, deals] = await Promise.all([
    readCalls(span.from, span.to),
    readFacts(window.startDay, window.today),
    readDeals(window.startDay, window.today),
  ]);
  const error = failed(calls, facts, deals);
  const flow =
    calls.ok && facts.ok && deals.ok
      ? buildChannelFlow({
          calls: calls.data.filter((c) => inRange(c.bookedDate, window)),
          captured: capturedByChannel(facts.data, window),
          wins: deals.data.filter((d) => d.dateWon >= window.startDay),
        })
      : null;
  const rows =
    flow && facts.ok
      ? buildChannelValue(flow, spendByFlowChannel(facts.data, window))
      : [];
  return (
    <DashboardCard
      id="channel-value"
      title="What each channel's calls are worth"
      source="The flow card's calls: Close first calls booked in the window and what became of them to date (§5, §6, §16), won deals and revenue from Close opportunities (§8). Spend: ad spend on the channel spine in the window, as the cost card counts it (§9). Close rate is won over booked."
    >
      {error ??
        (rows.length === 0 ? (
          <CardMessage tone="empty">
            No ad spend or first calls in {windowPhrase(window)}.
          </CardMessage>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-[0.8125rem]">
                <thead>
                  <tr
                    className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
                  >
                    <th className="py-2 pr-3 font-semibold">Channel</th>
                    {COLUMNS.map((c) => (
                      <th
                        key={c}
                        className="py-2 pr-3 text-right font-semibold"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-ui-line divide-y">
                  {rows.map((row) => (
                    <tr
                      key={row.key}
                      className={
                        row.smallSample ? "text-ui-text-subtle" : "text-ui-text"
                      }
                    >
                      <td className="py-2.5 pr-3 font-medium">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChannelLogo label={row.label} />
                          <span className="truncate">{row.label}</span>
                          {row.smallSample ? (
                            <span className="text-ui-text-subtle shrink-0 text-xs font-normal">
                              small sample
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <Cell>{dash(row.spend, money)}</Cell>
                      <Cell>{num(row.booked)}</Cell>
                      <Cell>{dash(row.showRate, pct)}</Cell>
                      <Cell>{dash(row.closeRate, pct)}</Cell>
                      <Cell>{money(row.revenue)}</Cell>
                      <Cell>{dash(row.costPerBooked, money)}</Cell>
                      <Cell>{dash(row.costPerWon, money)}</Cell>
                      <Cell>{dash(row.revenuePerDollar, perDollar)}</Cell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-ui-text-subtle mt-3 text-xs">
              Won deals lag: recent bookings have had less time to close, so
              compare channels on the same window and use 90 days for close
              rate. Under {SMALL_SAMPLE} booked calls is a small sample. “–”
              means no ad spend or nothing to divide by.
              {flow?.unvalued
                ? ` ${num(flow.unvalued)} won deals carry no value in Close and add nothing to revenue.`
                : ""}
            </p>
          </>
        ))}
    </DashboardCard>
  );
}
