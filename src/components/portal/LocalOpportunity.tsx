"use client";

import { useState } from "react";
import { portalCopy } from "@/lib/content/portal";
import type { PortalLocalMarket } from "@/lib/portal/types";
import { LocationMap } from "./LocationMap";

/** Live map plus the ranked list; hovering or focusing a row lights its pin. */
export function LocalOpportunity({ market }: { market: PortalLocalMarket }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {market.brief.map((paragraph) => (
        <p
          key={paragraph}
          className="text-[15px] leading-relaxed font-semibold text-slate-700"
        >
          {paragraph}
        </p>
      ))}
      <div className="grid overflow-hidden rounded-[12px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#55b8e8] md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <LocationMap
          market={market}
          activeRank={active}
          className="vp-map h-[300px] w-full min-w-0 bg-[#eaf6ff] md:h-full md:min-h-[400px]"
        />
        <ol className="min-w-0 divide-y divide-slate-200 border-t-2 border-[#111111] bg-white md:border-t-0 md:border-l-2">
          {market.locations.map((location) => (
            <li key={location.rank}>
              <button
                type="button"
                onMouseEnter={() => setActive(location.rank)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(location.rank)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(location.rank)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f5fbff] focus-visible:bg-[#eaf6ff] focus-visible:outline-none"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] text-xs font-black text-white">
                  {location.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-black text-[#111111]">
                    {location.name}
                  </span>
                  <span className="block text-sm font-semibold text-slate-600">
                    {location.type}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-black text-slate-600">
                  {location.distanceMi.toFixed(1)} mi
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-sm font-semibold text-slate-500">
        {portalCopy.mapCaption}
      </p>
    </div>
  );
}
