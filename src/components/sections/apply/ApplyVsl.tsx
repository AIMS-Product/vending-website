"use client";

import { useState } from "react";
import Image from "next/image";
import { applyVsl } from "@/lib/content/apply-page";
import { PlayIcon } from "./icons";

// Click-to-play VSL facade: renders the YouTube thumbnail + play button
// (mirrors Kody's mockup framing) and only loads the iframe/player after the
// visitor clicks, so the page never pays for an embedded player up front.
// Client component because it holds "has the visitor pressed play" state.
export function ApplyVsl() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="mx-auto max-w-[940px] px-5 py-20 lg:px-10">
      <div className="relative aspect-video overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[8px_8px_0_#111111]">
        {isPlaying ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${applyVsl.youtubeId}?autoplay=1&rel=0`}
            title={`${applyVsl.watchLabel} — Vendingpreneurs`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            aria-label={applyVsl.watchLabel}
            className="group absolute inset-0 block size-full focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Image
              src={`https://i.ytimg.com/vi/${applyVsl.youtubeId}/maxresdefault.jpg`}
              alt=""
              fill
              sizes="(min-width: 940px) 940px, 100vw"
              className="object-cover"
              priority
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/30" />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <span className="flex size-[82px] items-center justify-center rounded-full border-2 border-[#111111] bg-[#f47b3b] shadow-[4px_4px_0_#111111] transition group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0_#111111]">
                <PlayIcon className="size-7 translate-x-0.5 text-[#111111]" />
              </span>
              <span className="text-sm font-black tracking-[0.1em] text-white uppercase [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
                {applyVsl.watchLabel}
              </span>
            </span>
            <span className="absolute top-4 left-4 rounded-full border border-white/40 bg-black/35 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-white uppercase">
              {applyVsl.badge}
            </span>
          </button>
        )}
      </div>
      <p className="mx-auto mt-7 max-w-[64ch] text-center text-[17px] leading-relaxed font-semibold text-slate-700">
        {applyVsl.caption.map((segment, index) =>
          segment.strong ? (
            <strong key={index} className="text-[#111111]">
              {segment.text}
            </strong>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
    </section>
  );
}
