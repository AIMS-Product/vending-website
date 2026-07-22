import { applyVsl } from "@/lib/content/apply-page";
import { PlayIcon } from "./icons";

export function ApplyVsl() {
  return (
    <section className="mx-auto max-w-[940px] px-5 py-20 lg:px-10">
      {/* Styled video placeholder — no real VSL asset yet. Links to Mike's
          story on YouTube in the meantime. */}
      <a
        href={applyVsl.videoHref}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-video overflow-hidden rounded-[12px] border-2 border-[#111111] bg-gradient-to-br from-[#11566e] to-[#2a8fcc] shadow-[8px_8px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className="flex size-[82px] items-center justify-center rounded-full border-2 border-[#111111] bg-[#f47b3b] shadow-[4px_4px_0_#111111]">
            <PlayIcon className="size-7 text-[#111111]" />
          </span>
          <span className="text-sm font-black tracking-[0.1em] text-white uppercase">
            {applyVsl.watchLabel}
          </span>
        </div>
        <span className="absolute top-4 left-4 rounded-full border border-white/40 bg-black/35 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-white uppercase">
          {applyVsl.badge}
        </span>
      </a>
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
