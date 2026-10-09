import {
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type { FunnelBoard } from "@/lib/services/funnel-board";

interface FunnelBoardCrosswalkProps {
  board: FunnelBoard;
}

const TH = "px-3 py-2 text-right font-semibold whitespace-nowrap align-bottom";
const TD = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
const STICKY = "sticky left-0 z-10 bg-ui-surface";

/**
 * Where Close filed the calls each channel booked. The sales floor's sheet
 * reads Close's funnel field; this is the bridge from our channel to it.
 */
export function FunnelBoardCrosswalk({ board }: FunnelBoardCrosswalkProps) {
  if (board.crosswalk.length === 0) return null;
  const columnTotal = (funnel: string) =>
    board.crosswalk.reduce((sum, row) => sum + (row.funnels[funnel] ?? 0), 0);

  return (
    <section className={adminPanelClass} aria-label="Where Close credited it">
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>Where Close credited it</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Every call above: our channel down the side, the Close funnel the
          sales sheet files it under across the top. A call off the diagonal is
          one the sheet credits to a different funnel than the one that brought
          the lead (most often a site lead filed as Reactivation Scrapers or
          Internal Webinar).
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-ui-text-muted text-xs">
            <tr>
              <th
                scope="col"
                className={`${STICKY} px-4 py-2 text-left align-bottom font-semibold`}
              >
                Our channel
              </th>
              <th scope="col" className={TH}>
                Calls
              </th>
              {board.closeFunnels.map((funnel) => (
                <th key={funnel} scope="col" className={TH}>
                  <span className="inline-block max-w-[8rem] whitespace-normal">
                    {funnel}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.crosswalk.map((row) => (
              <tr key={row.channel} className="border-ui-line/60 border-t">
                <th
                  scope="row"
                  className={`${STICKY} px-4 py-1.5 text-left font-normal`}
                >
                  <span className="inline-flex items-center gap-2">
                    <ChannelLogo label={row.channel} />
                    {row.channel}
                    <span className="text-ui-text-subtle text-xs">
                      {row.group}
                    </span>
                  </span>
                </th>
                <td className={`${TD} font-semibold`}>{row.total}</td>
                {board.closeFunnels.map((funnel) => {
                  const n = row.funnels[funnel] ?? 0;
                  return (
                    <td key={funnel} className={TD}>
                      {n ? n : <span className="text-ui-text-subtle">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-ui-line border-t-2 font-semibold">
              <th scope="row" className={`${STICKY} px-4 py-2 text-left`}>
                Total
              </th>
              <td className={TD}>{board.total}</td>
              {board.closeFunnels.map((funnel) => (
                <td key={funnel} className={TD}>
                  {columnTotal(funnel)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {board.setters.length > 0 ? (
        <p className="border-ui-line text-ui-text-muted border-t px-4 py-3 text-xs">
          <span className="font-semibold">Setters on these calls:</span>{" "}
          {board.setters.map((s) => `${s.name}: ${s.calls}`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
