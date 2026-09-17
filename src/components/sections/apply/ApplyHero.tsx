import { Anton } from "next/font/google";
import {
  APPLY_QUIZ_ANCHOR,
  applyHero,
  applyQuiz,
} from "@/lib/content/apply-page";
import { LockIcon, StarRow } from "./icons";

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
// lines of uppercase.
const HIGHLIGHT = "$5-$60k/Month";

function Headline() {
  const [before, after] = applyHero.headline.split(HIGHLIGHT);
  // leading must stay at or above 1: an inline background on a tighter line
  // box paints over the lines above and below it.
  return (
    <h1 className="mt-5 max-w-[17ch] text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.14] font-normal tracking-[0.015em] text-[#111111] uppercase">
      {before}
      <span className="bg-[#2a8fcc] box-decoration-clone px-[0.08em] text-white shadow-[0.08em_0.08em_0_#111111]">
        {HIGHLIGHT}
      </span>
      {after}
    </h1>
  );
}

export function ApplyHero({
  body = applyHero.body,
  aside,
}: {
  body?: string;
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
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-x-14 gap-y-10 px-5 py-14 lg:grid-cols-[1fr_minmax(0,440px)] lg:px-10 lg:py-16">
        <div className="max-w-[620px]">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {applyHero.eyebrow}
          </p>

          <Headline />

          <p className="mt-4 max-w-[32ch] text-[clamp(0.9rem,1.3vw,1.05rem)] leading-[1.35] font-black tracking-[0.02em] text-[#066a99] uppercase">
            {applyHero.subheadline}
          </p>

          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.6] font-medium text-slate-600">
            {body}
          </p>

          {/* The proof used to sit under the form, which left this column
              ending in dead space beside a tall card. Next to the claim it
              does more work and the two columns finish closer together. */}
          <figure className="mt-8 max-w-[44ch] border-t-2 border-l-0 border-[#111111] pt-6">
            <StarRow
              className="flex gap-0.5 text-[#2a8fcc]"
              starClassName="size-[17px]"
            />
            <blockquote className="mt-3 text-[17px] leading-[1.45] font-black text-[#111111]">
              {applyQuiz.rail.quote}
            </blockquote>
            <figcaption className="mt-2.5 text-[13px] font-semibold text-slate-500">
              {applyQuiz.rail.attribution}
            </figcaption>
          </figure>

          <ul className="mt-7 flex flex-wrap items-baseline gap-x-7 gap-y-2.5">
            {applyHero.trustStats.map((stat) => (
              <li key={stat.label} className="flex items-baseline gap-1.5">
                <span className="text-xl leading-none font-black text-[#066a99]">
                  {stat.value}
                </span>
                <span className="text-[12.5px] font-semibold text-slate-500">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 flex items-center gap-2 text-[12.5px] font-semibold text-slate-500">
            <LockIcon className="size-3.5 text-[#066a99]" />
            {applyQuiz.rail.availabilityNote}
          </p>
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
