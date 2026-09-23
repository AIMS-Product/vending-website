import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { CTA_TRUST_LINE } from "@/lib/content/apply-page";
import { finalCta } from "@/lib/content/home";
import { finalCtaV2 } from "@/lib/content/home-v2";

export function FinalCtaV2() {
  const marqueeWords = Array.from({ length: 24 }, () => finalCtaV2.marqueeWord);

  return (
    <section className="relative overflow-hidden border-t-2 border-[#111111] bg-[#111111]">
      <div
        aria-hidden
        className="overflow-hidden border-b-2 border-[#111111] bg-[#2a8fcc] py-2.5"
      >
        <div className="v2-marquee flex w-max gap-10 hover:[animation-play-state:paused]">
          {marqueeWords.map((word, index) => (
            <span
              key={index}
              className="flex items-center gap-10 text-sm font-black tracking-widest whitespace-nowrap text-[#111111] uppercase"
            >
              {word}
              <span aria-hidden>↗</span>
            </span>
          ))}
        </div>
      </div>

      <span
        aria-hidden
        className="v2-display v2-outline-light pointer-events-none absolute -bottom-[0.16em] left-1/2 -translate-x-1/2 text-[24vw] leading-none whitespace-nowrap uppercase opacity-10 select-none"
      >
        {finalCtaV2.ghostWord}
      </span>

      <div className="relative mx-auto max-w-[1500px] px-5 py-24 text-center lg:px-10 lg:py-36">
        <h2
          data-reveal
          className="v2-display text-[clamp(3.5rem,8.5vw,8.5rem)] leading-[0.98] text-white uppercase"
        >
          <span className="block">{finalCtaV2.titleLines[0]}</span>
          <span className="mt-[0.08em] block">
            {/* ui/Highlight is an inline-block, so it can no longer paint
                over the line above (it clipped "CURIOUS IF YOUR MARKET"). */}
            <Highlight className="text-ink whitespace-normal">
              {finalCtaV2.titleLines[1]}
            </Highlight>
          </span>
        </h2>

        <p
          data-reveal
          className="mx-auto mt-8 max-w-2xl text-lg leading-8 font-semibold text-slate-300"
          style={{ "--v2-delay": "0.1s" } as CSSProperties}
        >
          {finalCta.body}
        </p>

        <div
          data-reveal
          className="mt-10 flex flex-col items-center gap-3.5"
          style={{ "--v2-delay": "0.18s" } as CSSProperties}
        >
          {/* On the ink band an ink border and ink shadow disappear, so this
              is the onInk button: white, sky shadow. */}
          <Button href={finalCta.cta.href} showArrow size="lg" variant="onInk">
            {finalCta.cta.label}
          </Button>
          {/* Slate-500 would fail contrast on this near-black band. */}
          <p className="text-sm font-medium text-slate-400">{CTA_TRUST_LINE}</p>
        </div>
      </div>
    </section>
  );
}
