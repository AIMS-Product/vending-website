"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { applyMembers } from "@/lib/content/apply-page";
import type { SuccessStoryCard } from "@/lib/content/apply-page";

// "Regular people who ran the system" — three full success-story cards
// (finished graphics from Kody) shown 3-across on desktop, stacked on mobile.
//
// Adam, 2026-09-17: the cards used to open the member's story on youtube.com in
// a new tab, which is the one thing a booking page cannot afford — the proof
// itself was walking visitors off the page. The video now plays in a dialog
// over the page instead, so the story still lands and the form stays a scroll
// away. Native <dialog> carries the backdrop, Escape-to-close and focus
// trapping, so none of that is hand-rolled.
//
// The card art carries all the copy; each control's aria-label and the image
// alt make the story available to screen readers, and the play badge signals
// the card opens a video.
export function ApplyMembers() {
  const [active, setActive] = useState<SuccessStoryCard | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) dialog.showModal();
    if (!active && dialog.open) dialog.close();
  }, [active]);

  return (
    <section className="mx-auto max-w-[1120px] px-5 py-24 lg:px-10">
      <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyMembers.eyebrow}
      </p>
      <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
        {applyMembers.title}
      </h2>

      <ul className="mt-12 grid gap-7 md:grid-cols-3">
        {applyMembers.cards.map((card) => (
          <li key={card.name} className="min-w-0">
            <button
              type="button"
              onClick={() => setActive(card)}
              aria-label={`${card.name} — play the story`}
              className="group relative block w-full overflow-hidden rounded-[16px] transition duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Image
                src={card.image}
                alt={card.alt}
                width={880}
                height={1500}
                sizes="(min-width: 768px) 360px, 100vw"
                className="h-auto w-full"
              />
              {/* Play badge — signals the card opens a video, brightens on hover. */}
              <span
                aria-hidden
                className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full border-2 border-white bg-[#111111]/70 text-white shadow-[3px_3px_0_rgba(0,0,0,0.25)] backdrop-blur-sm transition group-hover:bg-[#2a8fcc] group-hover:text-[#111111]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="ml-0.5 size-5"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
            <p className="mt-3 text-center text-sm font-black tracking-wide text-[#066a99] uppercase">
              <button
                type="button"
                onClick={() => setActive(card)}
                className="hover:text-[#111111] focus-visible:underline focus-visible:outline-none"
              >
                Watch {card.name.split(" ")[0]}&rsquo;s story
              </button>
            </p>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={active ? `${active.name} — success story` : undefined}
        onClose={() => setActive(null)}
        // Clicking the backdrop lands on the dialog element itself; clicks on
        // the player bubble from its children, so they are left alone.
        onClick={(event) => {
          if (event.target === dialogRef.current) setActive(null);
        }}
        className="m-auto w-[min(900px,92vw)] rounded-[12px] border-2 border-[#111111] bg-[#111111] p-0 shadow-[8px_8px_0_#55b8e8] backdrop:bg-black/70"
      >
        {active ? (
          <div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm font-black tracking-wide text-white uppercase">
                {active.name}
              </p>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Close the video"
                className="flex size-9 items-center justify-center rounded-full border-2 border-white/40 text-white transition hover:bg-white hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:outline-none"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {/* Mounted only while open, so closing stops playback and no page
                ever loads three players up front. */}
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${active.youtubeId}?autoplay=1&rel=0`}
              title={`${active.name} — success story`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
