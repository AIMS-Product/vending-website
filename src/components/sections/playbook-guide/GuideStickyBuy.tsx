"use client";

import { useEffect, useState } from "react";

interface GuideStickyBuyProps {
  title: string;
  /** Small context line under the title, like the order card's. */
  note?: string;
  children: React.ReactNode;
}

/** Bottom buy bar once the hero button has scrolled away; hidden near the final offer. */
export function GuideStickyBuy({ title, note, children }: GuideStickyBuyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const fromBottom =
        document.body.offsetHeight - (window.innerHeight + window.scrollY);
      setVisible(window.scrollY > 700 && fromBottom > 900);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`border-ink fixed inset-x-0 bottom-0 z-40 border-t-2 bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 lg:px-10">
        <span className="max-sm:hidden">
          <span className="text-ink block text-[15px] leading-tight font-black">
            {title}
          </span>
          {note ? (
            <span className="text-ink/60 block text-xs font-bold">{note}</span>
          ) : null}
        </span>
        {children}
      </div>
    </div>
  );
}
