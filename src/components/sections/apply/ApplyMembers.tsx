"use client";

import { useState } from "react";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { applyMembers } from "@/lib/content/apply-page";
import { preCallOperators } from "@/lib/content/pre-call-resources";
import { PlayIcon } from "./icons";

// Adam, 2026-09-17: this section used to be three finished card graphics whose
// numbers lived inside the PNGs, each linking out to youtube.com. It now shows
// the same top-tier member stories the pre-call page runs, read straight off
// preCallOperators so the two surfaces can never disagree about a figure.
//
// Two across rather than three: at three the player was too small for a face to
// read, which is the whole point of a video testimonial.
const TOP_STORIES = preCallOperators.items.filter(
  (item) => item.tier === "high" && "embedId" in item,
);

// The players are mounted on click, not on load. Vidalytics autoplays muted,
// which suits the pre-call page — that visitor has already booked. Here it
// would put four videos talking at someone mid-form, which is the distraction
// the header and footer came off to avoid. It also keeps four player scripts
// off the initial load.
function StoryPlayer({ embedId, name }: { embedId: string; name: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) return <VidalyticsPlayer embedId={embedId} className="mt-4" />;

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${name}'s story`}
      className="group mt-4 flex aspect-video w-full items-center justify-center rounded-[12px] border-2 border-[#111111] bg-[#0b1b26] shadow-[8px_8px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[10px_10px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <span className="flex flex-col items-center gap-3">
        <span className="flex size-[68px] items-center justify-center rounded-full border-2 border-[#111111] bg-[#2a8fcc] shadow-[4px_4px_0_#111111] transition group-hover:-translate-y-0.5">
          <PlayIcon className="size-6 translate-x-0.5 text-[#111111]" />
        </span>
        <span className="text-[13px] font-black tracking-[0.1em] text-white uppercase">
          Watch {name.split(" ")[0]}&rsquo;s story
        </span>
      </span>
    </button>
  );
}

export function ApplyMembers() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-20 lg:px-10">
      <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyMembers.eyebrow}
      </p>
      <h2 className="mt-3 max-w-[20ch] text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] font-black tracking-[-0.015em] text-[#111111] uppercase">
        {applyMembers.title}
      </h2>
      {/* Required wherever these figures appear: ranking members by revenue
          reads as a promise unless it says plainly what the numbers are. */}
      <p className="mt-4 max-w-[68ch] text-[14px] leading-[1.6] font-medium text-slate-500">
        {preCallOperators.disclaimer}
      </p>

      <ul className="mt-12 grid gap-x-10 gap-y-14 md:grid-cols-2">
        {TOP_STORIES.map((story) => (
          <li key={story.id} className="min-w-0">
            <h3 className="text-[clamp(1.15rem,1.8vw,1.4rem)] leading-tight font-black text-[#111111]">
              {story.name}
            </h3>
            <p className="mt-2 text-[12.5px] font-black tracking-[0.08em] text-[#066a99] uppercase">
              {story.stats.join(" · ")}
            </p>
            <StoryPlayer
              embedId={(story as { embedId: string }).embedId}
              name={story.name}
            />
            <p className="mt-4 text-[15px] leading-[1.6] font-medium text-slate-600">
              {story.blurb}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
