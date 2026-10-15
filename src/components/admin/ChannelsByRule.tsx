import {
  adminCardClass,
  adminEyebrowClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { FLOW_STAGES, type ChannelFlow } from "@/lib/analytics/channel-flow";
import { readRuleFlow } from "@/lib/services/analytics-dashboard-data";

/**
 * Booked, showed, qualified and won by channel on the rule every booked-call
 * surface uses (Jess's Marketing MTD rule): the dashboard flow card's own
 * computation (`readRuleFlow`) for this page's range, so the two agree.
 */
export async function ChannelsByRule({
  startDay,
  endDay,
}: {
  startDay: string;
  endDay: string;
}) {
  const flow = await readRuleFlow(startDay, endDay);
  if (!flow.ok) {
    return (
      <section className={adminCardClass} aria-label="Booked by channel">
        <h2 className={adminEyebrowClass}>Booked by channel</h2>
        <p className="text-ui-text-subtle mt-2 text-sm">{flow.error}</p>
      </section>
    );
  }
  return <RuleTable flow={flow.data} />;
}

const STAGES = [1, 2, 3, 4] as const;

/** Exported for tests only. */
export function RuleTable({ flow }: { flow: ChannelFlow }) {
  const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
  return (
    <section className={adminCardClass} aria-label="Booked by channel">
      <h2 className={adminEyebrowClass}>Booked by channel</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">
        First calls booked in this range, counted as Marketing MTD and the
        dashboard count them: a Lane 1 owner, not canceled, outside the US or
        another brand, plus Reactivation Scrapers leads by any owner. A lead
        that came in on a Google ad click counts as Google Ads. Showed and
        qualified are what the rep logged; won is a deal won on or after the
        range&apos;s first day. Campaign and creative rows below cannot carry
        this count; they show site bookings from Calendly.
      </p>
      {flow.totals[1] === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No first calls in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[0.8125rem]">
            <thead className={adminStickyHeadClass}>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-3 font-semibold">Channel</th>
                {STAGES.map((i) => (
                  <th key={i} className="py-2 pr-3 text-right font-semibold">
                    {FLOW_STAGES[i]}
                  </th>
                ))}
                <th className="py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {flow.bands
                .filter((b) => b.values[1] > 0)
                .map((b) => (
                  <tr key={b.key}>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <ChannelLogo label={b.label} />
                        {b.label}
                      </span>
                    </td>
                    {STAGES.map((i) => (
                      <td key={i} className="py-2 pr-3 text-right tabular-nums">
                        {b.values[i].toLocaleString()}
                      </td>
                    ))}
                    <td className="py-2 text-right tabular-nums">
                      {money(b.revenue)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-ui-line border-t font-semibold">
                <td className="py-2 pr-3">Total</td>
                {STAGES.map((i) => (
                  <td key={i} className="py-2 pr-3 text-right tabular-nums">
                    {flow.totals[i].toLocaleString()}
                  </td>
                ))}
                <td className="py-2 text-right tabular-nums">
                  {money(flow.revenue)}
                </td>
              </tr>
            </tfoot>
          </table>
          {flow.unvalued > 0 ? (
            <p className="text-ui-text-subtle mt-2 text-xs">
              {flow.unvalued} won{" "}
              {flow.unvalued === 1 ? "deal has" : "deals have"} no value in
              Close: counted in Won, not in Revenue.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
