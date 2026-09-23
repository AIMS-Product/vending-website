import { Anton } from "next/font/google";
import {
  APPLY_QUIZ_ANCHOR,
  APPLY_VSL_ANCHOR,
  applyHero,
} from "@/lib/content/apply-page";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, PlayIcon } from "./icons";

// The display face the home hero already uses. The booking funnels were set in
// Inter black, which at headline size reads as bulk rather than emphasis
// (Adam, 2026-09-17): Anton is narrower, so the same claim fits three lines
// instead of four and stops feeling boxed in.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

// The claim is Kody's approved wording and is never reworded. Splitting it for
// the highlight is presentation only: the money phrase gets the home page's
// blue block so the eye lands on the number instead of reading four uniform
// lines of uppercase. The pattern also matches the legacy lead pages' own
// phrasing ("$5k-$60k Per Month").
const MONEY_PHRASE =
  /\$[\d,.]+k?\s*[-–]\s*\$[\d,.]+k?(?:\s*\/\s*month|\s+per\s+month)?/i;

// Longer headlines (the legacy lead pages run to 20 words) step down a size so
// they stay on the first screen.
const LONG_HEADLINE = 60;

export function splitMoneyPhrase(text: string) {
  const match = MONEY_PHRASE.exec(text);
  if (!match) return null;
  return {
    before: text.slice(0, match.index),
    money: match[0],
    after: text.slice(match.index + match[0].length),
  };
}

function Headline({ text }: { text: string }) {
  const parts = splitMoneyPhrase(text);
  // An inline background paints the font's whole content area, which for
  // Anton is taller than the line box, so it ran over the lines above and
  // below (Adam, 2026-09-22). As an inline-block the line grows to fit it.
  return (
    <h1
      className={cn(
        "mt-5 font-normal tracking-[0.015em] text-[#111111] uppercase",
        // Size before leading: tailwind-merge drops a leading-* that comes
        // before a font-size class, since text-* can carry a line-height.
        text.length > LONG_HEADLINE
          ? "max-w-[24ch] text-[clamp(1.9rem,3.4vw,2.9rem)]"
          : "max-w-[17ch] text-[clamp(2.2rem,4.4vw,3.6rem)]",
        // The highlight block needs the taller line; a plain headline sits
        // tighter so a long one does not read as widely spaced lines.
        parts ? "leading-[1.14]" : "leading-[1.08]",
      )}
    >
      {parts ? (
        <>
          {parts.before}
          <Highlight>{parts.money}</Highlight>
          {parts.after}
        </>
      ) : (
        text
      )}
    </h1>
  );
}

type HeroCopy = {
  eyebrow: string;
  headline: string;
  subheadline?: string;
  /** Pointer to the VSL under the hero. Leave it out on pages with no VSL. */
  videoCue?: string;
};

export function ApplyHero({
  body = applyHero.body,
  copy = applyHero,
  wideAside = false,
  aside,
}: {
  body?: string;
  copy?: HeroCopy;
  // The legacy long form and full Calendly need more room than the 440px the
  // short booking card uses.
  wideAside?: boolean;
  // The booking card. Adam, 2026-09-17: on every booking page the copy runs
  // left and the form/calendar sits beside it on the first screen — a form the
  // visitor has to scroll to costs bookings. It carries the CTA anchor, so
  // every "Book Your Call" on the page scrolls back to this one form and the
  // page never renders two.
  aside?: React.ReactNode;
} = {}) {
  return (
    <section
      className={`${anton.variable} relative isolate overflow-hidden [&_h1]:font-[family-name:var(--font-anton),Arial_Narrow,sans-serif]`}
    >
      {/* Dotted paper-blue wash, matching the mockup hero band. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[#eaf6ff]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className={cn(
          "relative mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-x-14 gap-y-10 px-5 py-14 lg:px-10 lg:py-16",
          wideAside
            ? "lg:grid-cols-[1fr_minmax(0,540px)]"
            : "lg:grid-cols-[1fr_minmax(0,440px)]",
        )}
      >
        <div className="max-w-[620px]">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {copy.eyebrow}
          </p>

          <Headline text={copy.headline} />

          {copy.subheadline ? (
            <p className="mt-4 max-w-[32ch] text-[clamp(0.9rem,1.3vw,1.05rem)] leading-[1.35] font-black tracking-[0.02em] text-[#066a99] uppercase">
              {copy.subheadline}
            </p>
          ) : null}

          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.6] font-medium text-slate-600">
            {body}
          </p>

          {/* Adam, 2026-09-22: the quote, stats and availability note that sat
              here made this column far taller than the form beside it. The
              only thing left under the pitch is a pointer to the VSL, which
              visitors were not finding below the fold. */}
          {copy.videoCue ? (
            <a
              href={`#${APPLY_VSL_ANCHOR}`}
              className="group mt-8 inline-flex items-center gap-3 text-[15px] font-black tracking-[0.02em] text-[#111111] uppercase"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-[#2a8fcc] text-white shadow-[3px_3px_0_#111111] transition-transform group-hover:translate-y-0.5">
                <PlayIcon className="size-4 translate-x-px" />
              </span>
              <span className="flex items-center gap-1.5 underline decoration-[#2a8fcc] decoration-2 underline-offset-4">
                {copy.videoCue}
                <ChevronDownIcon className="size-4 text-[#066a99] motion-safe:animate-bounce" />
              </span>
            </a>
          ) : null}
        </div>

        {aside ? (
          <div id={APPLY_QUIZ_ANCHOR} className="w-full scroll-mt-24">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
