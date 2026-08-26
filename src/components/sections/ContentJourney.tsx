"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
  PageCta,
  PageFeature,
  PageStep,
} from "@/lib/content/content-page";
import {
  CheckIcon,
  EYEBROW,
  Media,
  RAIL_CLEARANCE,
  StatStrip,
  WRAP,
  stepAccent,
  stepWash,
} from "./content-page-parts";

/**
 * The three-beat strip and the feature blocks used to be two sections that
 * said the same thing twice: a shorthand promise, then the same promise at
 * length a screen later. They are one section now. The beats became a rail
 * that tracks which block you are reading, and the blocks became its panels.
 *
 * The rail is navigation, not an ARIA tab widget: every block stays in the
 * document and stays scrollable past, so `role="tab"`/`tabpanel` would promise
 * a show/hide that does not happen. Plain anchors mean it also works with no
 * JavaScript at all — the scroll-spy is the only part that needs the client.
 */
export function ContentJourney({
  thesis,
  steps,
  features,
  stepsCta,
}: {
  thesis: string;
  steps: ReadonlyArray<PageStep>;
  features: ReadonlyArray<PageFeature>;
  stepsCta?: PageCta;
}) {
  const [active, setActive] = useState(0);
  const blocks = useRef<Array<HTMLElement | null>>([]);
  const tabs = useRef<Array<HTMLAnchorElement | null>>([]);

  // Every registry entry pairs one step to one feature. If a future record
  // ever breaks that, pair as far as they match rather than dropping content
  // on the floor.
  const paired = Math.min(steps.length, features.length);

  useEffect(() => {
    const nodes = blocks.current.filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    // A thin band across the middle of the viewport is the reading line.
    // Whichever block is crossing it is the one being read; the topmost wins
    // when a short block leaves two in the band at once.
    const visible = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting) visible.add(index);
          else visible.delete(index);
        }
        if (visible.size > 0) setActive(Math.min(...visible));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  // On a phone the rail scrolls sideways, so the active chip has to be walked
  // into view or the highlight lands off-screen. `block: "nearest"` keeps this
  // from yanking the page vertically.
  useEffect(() => {
    tabs.current[active]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [active]);

  const accent = stepAccent(active);

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-thesis"
      className="ease-out-quart px-5 py-20 transition-colors duration-700 lg:px-10 lg:py-24"
      style={{ background: stepWash(active) }}
    >
      <div className={WRAP}>
        <h2
          id="how-it-works-thesis"
          className="mx-auto max-w-4xl text-center text-2xl leading-tight font-black text-balance text-[#111111] uppercase sm:text-3xl lg:text-4xl"
        >
          {thesis}
        </h2>

        <Rail
          steps={steps.slice(0, paired)}
          active={active}
          tabs={tabs}
          accent={accent}
        />

        {stepsCta && (
          <div className="mt-8 flex justify-center">
            <Button
              href={stepsCta.href}
              variant={stepsCta.variant ?? "primary"}
            >
              {stepsCta.label}
            </Button>
          </div>
        )}

        <div className="mt-16 flex flex-col gap-20 lg:mt-20 lg:gap-28">
          {features.slice(0, paired).map((feature, index) => (
            <FeatureBlock
              key={feature.eyebrow}
              feature={feature}
              step={steps[index]}
              index={index}
              isActive={index === active}
              ref={(node) => {
                blocks.current[index] = node;
              }}
              // Alternate which side the visual sits on so a run of blocks
              // doesn't read as one long column.
              mediaFirst={index % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The sticky rail. Parks under the site header, names the three beats, and
 * shows which one you are inside. The rule underneath is the same information
 * as a bar rather than as a colour, for anyone who cannot separate the blues.
 */
function Rail({
  steps,
  active,
  tabs,
  accent,
}: {
  steps: ReadonlyArray<PageStep>;
  active: number;
  tabs: React.RefObject<Array<HTMLAnchorElement | null>>;
  accent: string;
}) {
  return (
    <div className="sticky top-[82px] z-20 mt-10 -mb-2 lg:mt-14">
      <nav
        aria-label="How it works"
        className="rounded-[12px] border-2 border-[#111111] bg-white/95 p-2 shadow-[6px_6px_0_#111111] backdrop-blur-md"
      >
        <ol className="scrollbar-none flex gap-2 overflow-x-auto">
          {steps.map((step, index) => {
            const isActive = index === active;
            return (
              // Natural width on a phone so a chip is never clipped mid-word
              // (the row scrolls instead, and the active chip is walked into
              // view); equal thirds once there is room for all three.
              <li key={step.label} className="shrink-0 lg:min-w-0 lg:flex-1">
                <a
                  href={`#step-${index + 1}`}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "ease-out-quart flex h-full w-full items-center gap-2.5 rounded-[8px] border-2 px-3 py-2.5 text-left transition-all duration-500 focus-visible:ring-2 focus-visible:ring-[#2a8fcc] focus-visible:ring-offset-2 focus-visible:outline-none lg:gap-3",
                    isActive
                      ? "border-[#111111] text-[#111111]"
                      : "border-transparent text-slate-600 hover:border-[#111111]/20 hover:bg-[#f5fbff]",
                  )}
                  style={isActive ? { background: accent } : undefined}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "ease-out-quart flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] text-sm font-black tabular-nums transition-colors duration-500",
                      isActive ? "bg-white" : "bg-[#f5fbff]",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] leading-tight font-black uppercase">
                      {stepName(step.label)}
                    </span>
                    <span
                      className={cn(
                        "ease-out-quart mt-0.5 hidden truncate text-xs leading-tight font-semibold transition-colors duration-500 lg:block",
                        isActive ? "text-[#111111]/70" : "text-slate-500",
                      )}
                    >
                      {step.title}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>

        <div
          aria-hidden
          className="mx-1 mt-2 h-1 overflow-hidden rounded-full bg-[#e6f3ff]"
        >
          <div
            className="ease-out-quart h-full rounded-full transition-all duration-700"
            style={{
              width: `${((active + 1) / Math.max(steps.length, 1)) * 100}%`,
              background: accent,
            }}
          />
        </div>
      </nav>
    </div>
  );
}

/**
 * A step label carries its own number for the old strip ("01 · Find"). The
 * rail draws the number itself, so strip it off rather than printing it twice.
 */
function stepName(label: string): string {
  return label.replace(/^\s*\d+\s*[·.\-–—]\s*/, "");
}

function FeatureBlock({
  feature,
  step,
  index,
  isActive,
  mediaFirst,
  ref,
}: {
  feature: PageFeature;
  step: PageStep | undefined;
  index: number;
  isActive: boolean;
  mediaFirst: boolean;
  ref: (node: HTMLElement | null) => void;
}) {
  const { media } = feature;
  const accent = stepAccent(index);
  const headingId = `step-${index + 1}-title`;

  const copy = (
    <div className="min-w-0">
      <p className="flex items-center gap-3">
        <span
          aria-hidden
          className="ease-out-quart flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] text-sm font-black tabular-nums transition-transform duration-500"
          style={{
            background: accent,
            transform: isActive ? "scale(1)" : "scale(0.88)",
          }}
        >
          {index + 1}
        </span>
        <span className={EYEBROW}>{feature.eyebrow}</span>
      </p>
      <h2
        id={headingId}
        className={cn(
          "mt-5 text-2xl leading-tight font-black text-balance break-words text-[#111111] uppercase sm:text-3xl lg:text-4xl",
          !media && "max-w-4xl",
        )}
      >
        {feature.title}
      </h2>
      <p
        className={cn(
          "mt-5 text-lg leading-8 font-semibold text-slate-700",
          !media && "max-w-3xl",
        )}
      >
        {feature.body}
      </p>
      {/* At full width a single column of checks leaves half the row empty,
          so the points run two-up from the large breakpoint. */}
      <ul
        className={cn(
          "mt-7 gap-x-10 gap-y-4",
          media ? "space-y-4" : "grid sm:grid-cols-2",
        )}
      >
        {feature.points.map((point) => (
          <li key={point} className="reveal-item flex gap-4">
            <CheckIcon accent={accent} />
            <span className="font-semibold text-slate-700">{point}</span>
          </li>
        ))}
      </ul>
      {feature.stats && feature.stats.length > 0 && (
        <StatStrip stats={feature.stats} accent={accent} />
      )}
    </div>
  );

  return (
    <article
      id={`step-${index + 1}`}
      ref={ref}
      data-index={index}
      aria-labelledby={headingId}
      className={cn("reveal-block", RAIL_CLEARANCE)}
    >
      {/* Screen-reader-only restatement of the beat this block answers. The
          rail says it visually; without this the number badge is decorative
          and the block loses its place in the sequence. */}
      {step && <p className="sr-only">{`Step ${index + 1}: ${step.title}`}</p>}
      {media ? (
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Media
            media={media}
            accent={accent}
            className={mediaFirst ? "" : "lg:order-2"}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {copy}
        </div>
      ) : (
        copy
      )}
    </article>
  );
}
