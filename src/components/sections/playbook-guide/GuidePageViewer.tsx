"use client";

import Image from "next/image";
import { type KeyboardEvent, useRef, useState } from "react";

interface ViewerPage {
  src: string;
  alt: string;
  width: number;
  height: number;
  locked: boolean;
}

/** Badge over a blurred paid page. */
export function LockedBadge() {
  return (
    <span className="absolute inset-0 flex items-center justify-center p-4">
      <span className="border-ink text-ink flex items-center gap-2 border-2 bg-white px-4 py-2 text-sm font-black shadow-[4px_4px_0_#111111]">
        <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
          <rect
            x="3"
            y="7"
            width="10"
            height="7"
            rx="1"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        Unlocks with the playbook
      </span>
    </span>
  );
}

/** Swipeable sample of the PDF: native scroll-snap, arrows for mouse users. */
export function GuidePageViewer({
  pages,
  totalPages,
}: {
  pages: readonly ViewerPage[];
  totalPages: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  /** Page the last key press aimed at; smooth scroll lags behind it. */
  const target = useRef(0);

  const go = (to: number) => {
    const el = track.current;
    if (!el || to < 0 || to >= pages.length) return;
    target.current = to;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: to * el.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    go(target.current + (e.key === "ArrowRight" ? 1 : -1));
  };
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const at = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(at);
    // Swipes move the page too; re-sync once the track lands on a page.
    if (Math.abs(el.scrollLeft - at * el.clientWidth) < 1) target.current = at;
  };

  const arrow =
    "border-ink flex size-11 items-center justify-center rounded-full border-2 bg-white text-ink transition hover:bg-brand-50 disabled:opacity-30";

  return (
    <figure className="mx-auto w-full max-w-[440px]">
      <div className="border-ink border-2 bg-white shadow-[8px_8px_0_#111111]">
        <div
          ref={track}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          tabIndex={0}
          aria-label="Sample pages from the playbook"
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((page, i) => (
            <div
              key={page.src}
              className="relative w-full shrink-0 snap-center"
            >
              <Image
                src={page.src}
                alt={page.alt}
                width={page.width}
                height={page.height}
                sizes="(min-width: 1024px) 440px, 90vw"
                priority={i === 0}
                className="h-auto w-full"
              />
              {page.locked ? <LockedBadge /> : null}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Previous page"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          className={arrow}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
            <path
              d="M13 8H3M7 4 3 8l4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-ink/70 text-sm font-bold tabular-nums"
        >
          Sample page {index + 1} of {pages.length}
          <span className="text-ink/50 font-normal max-sm:hidden">
            {" "}
            · {totalPages}-page PDF
          </span>
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={index === pages.length - 1}
          onClick={() => go(index + 1)}
          className={arrow}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </figcaption>
    </figure>
  );
}
