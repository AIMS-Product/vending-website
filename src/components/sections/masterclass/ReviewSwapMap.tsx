import { COMMS_COPY, SWAP_ROWS } from "@/lib/content/masterclass-review-comms";
import { cn } from "@/lib/utils";
import { CARD, CHIP, H2 } from "./ReviewCommsShared";

/** What each journey step is today (GHL) and after the swap (our site). */
export function ReviewSwapMap() {
  return (
    <section aria-labelledby="swap-map-heading">
      <h2 id="swap-map-heading" className={H2}>
        {COMMS_COPY.swapHeading}
      </h2>
      <p className="mt-3 max-w-[64ch] text-[15px] text-slate-600">
        {COMMS_COPY.swapIntro}
      </p>
      <ol className="mt-5 grid gap-3">
        {SWAP_ROWS.map((row) => (
          <li key={row.step} className={cn(CARD, "p-4")}>
            <p className="text-ink flex flex-wrap items-center gap-2 font-black uppercase">
              {row.step}
              <span className={cn(CHIP, "bg-tint text-eyebrow")}>
                {row.owner}
              </span>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-control bg-slate-50 p-3">
                <p className="text-xs font-black tracking-wider text-slate-500 uppercase">
                  Today
                </p>
                <p className="mt-1 text-sm [overflow-wrap:anywhere] text-slate-700">
                  {row.today}
                </p>
              </div>
              <div className="rounded-control bg-tint p-3">
                <p className="text-eyebrow text-xs font-black tracking-wider uppercase">
                  After the swap
                </p>
                <p className="text-ink mt-1 text-sm [overflow-wrap:anywhere]">
                  {row.after}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-bold">Change: </span>
              {row.change}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
