import { applyYouTube } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";
import { PlayIcon } from "./icons";

export function ApplyYouTube() {
  return (
    <section className="mx-auto max-w-[1080px] px-5 py-24 lg:px-10">
      <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyYouTube.eyebrow}
      </p>
      <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
        {applyYouTube.title}
      </h2>
      <p className="mt-4 text-center text-lg font-semibold text-slate-700">
        Start here. Channel:{" "}
        <a
          href={applyYouTube.channelHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-black text-[#066a99] underline decoration-2 underline-offset-4 hover:text-[#111111]"
        >
          {applyYouTube.channelLabel}
        </a>
      </p>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        {applyYouTube.groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-4 text-sm font-black tracking-wide text-[#066a99] uppercase">
              {group.title}
            </h3>
            <ul className="flex flex-col gap-3">
              {group.videos.map((video) => (
                <li key={video.url}>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3.5 rounded-[10px] border-2 border-[#111111] bg-white p-4 shadow-[3px_3px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:outline-none"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b]">
                      <PlayIcon className="size-4 text-[#111111]" />
                    </span>
                    <span className="text-[15px] leading-snug font-semibold text-[#111111]">
                      {video.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <ApplyCtaButton>{applyYouTube.ctaLabel}</ApplyCtaButton>
      </div>
    </section>
  );
}
