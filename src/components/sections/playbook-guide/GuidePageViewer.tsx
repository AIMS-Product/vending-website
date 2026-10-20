"use client";

import Image from "next/image";
import { useRef, useState } from "react";

interface ViewerPage {
  src: string;
  alt: string;
  width: number;
  height: number;
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

  const go = (to: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const arrow =
    "border-ink flex size-11 items-center justify-center rounded-full border-2 bg-white text-ink transition hover:bg-brand-50 disabled:opacity-30";

  return (
    <figure className="mx-auto w-full max-w-[440px]">
      <div className="border-ink border-2 bg-white shadow-[8px_8px_0_#111111]">
        <div
          ref={track}
          onScroll={onScroll}
          tabIndex={0}
          aria-label="Sample pages from the playbook"
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((page, i) => (
            <Image
              key={page.src}
              src={page.src}
              alt={page.alt}
              width={page.width}
              height={page.height}
              sizes="(min-width: 1024px) 440px, 90vw"
              priority={i === 0}
              className="h-auto w-full shrink-0 snap-center"
            />
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
        <span className="text-ink/70 text-sm font-bold tabular-nums">
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
