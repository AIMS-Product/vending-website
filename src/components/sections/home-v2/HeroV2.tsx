import type { CSSProperties } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { hero } from "@/lib/content/home";
import { heroV2 } from "@/lib/content/home-v2";

// fallow-ignore-next-line complexity
export function HeroV2() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111111] bg-[#f5fbff]">
      <div
        aria-hidden
        className="v2-dots absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,transparent_0%,black_40%,black_80%,transparent_100%)]"
      />

      <div className="mx-auto grid max-w-[1500px] items-center gap-14 px-5 pt-16 pb-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10 lg:pt-24 lg:pb-20">
        <div className="flex flex-col">
          <p className="v2-rise inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-[#111111] bg-white px-4 py-1.5 text-xs font-black tracking-wide text-[#111111] uppercase shadow-[3px_3px_0_#111111]">
            <span aria-hidden className="size-2 rounded-full bg-[#f47b3b]" />
            {heroV2.eyebrow}
          </p>

          <h1 className="v2-display mt-7 text-[clamp(3.4rem,6.4vw,6.5rem)] leading-[0.98] text-[#111111] uppercase">
            {heroV2.titleLines.map((line, lineIndex) => (
              <span
                key={lineIndex}
                className="-mb-[0.12em] block overflow-hidden pb-[0.12em]"
              >
                <span
                  className="v2-rise block"
                  style={
                    {
                      "--v2-delay": `${0.06 + lineIndex * 0.09}s`,
                    } as CSSProperties
                  }
                >
                  {line.map((segment) =>
                    segment.highlight ? (
                      <span key={segment.text} className="v2-highlight">
                        {segment.text}
                      </span>
                    ) : (
                      segment.text
                    ),
                  )}
                </span>
              </span>
            ))}
          </h1>

          <div
            className="v2-rise mt-8 max-w-xl space-y-4 text-lg leading-8 font-semibold text-slate-700"
            style={{ "--v2-delay": "0.34s" } as CSSProperties}
          >
            {hero.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div
            className="v2-rise mt-9 flex flex-wrap items-center gap-4"
            style={{ "--v2-delay": "0.42s" } as CSSProperties}
          >
            <Button href={hero.cta.href} showArrow>
              {hero.cta.label}
            </Button>
            <Button href={heroV2.secondaryCta.href} variant="ghost">
              {heroV2.secondaryCta.label}
            </Button>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 translate-x-4 translate-y-4 rotate-1 rounded-[14px] border-2 border-[#111111] bg-[#55b8e8]"
          />
          <div className="v2-settle group relative aspect-square w-full overflow-hidden rounded-[12px] border-2 border-[#111111] bg-white lg:aspect-[5/4]">
            <Image
              src={hero.image.src}
              alt={hero.image.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
            />
          </div>

          {heroV2.badges.map((badge, index) => (
            <HeroBadge
              key={badge.label}
              badge={badge}
              className={
                index === 0 ? "top-6 -left-4 lg:-left-8" : "right-5 -bottom-5"
              }
              delay={`${index * 0.7}s`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

type HeroBadgeProps = {
  badge: (typeof heroV2.badges)[number];
  className: string;
  delay: string;
};

function HeroBadge({ badge, className, delay }: HeroBadgeProps) {
  return (
    <div
      aria-hidden
      className={`v2-float absolute hidden flex-col items-start rounded-[10px] border-2 border-[#111111] bg-white px-4 py-2.5 shadow-[5px_5px_0_#111111] sm:flex ${className}`}
      style={{ "--v2-tilt": badge.tilt, "--v2-delay": delay } as CSSProperties}
    >
      <span className="v2-display text-2xl leading-none text-[#d6531f]">
        {badge.value}
      </span>
      <span className="mt-1 text-[11px] font-black tracking-wide text-[#111111] uppercase">
        {badge.label}
      </span>
    </div>
  );
}
