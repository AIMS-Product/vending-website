import { APPLY_QUIZ_ANCHOR, APPLY_VSL_ANCHOR } from "@/lib/content/apply-page";
import { SaveSeatLink } from "@/components/sections/masterclass/SaveSeatLink";
import { ChevronDownIcon, PlayIcon } from "@/components/sections/apply/icons";
import { Wordmark } from "@/components/site/Wordmark";
import { Highlight } from "@/components/ui/Highlight";
import {
  WATCH_HEADING_ID,
  heroForAngle,
  hostCopy,
  masterclassTakeaways,
} from "@/lib/content/masterclass";
import type { MasterclassEvent } from "@/lib/services/masterclass-event";

/** Brand-700 check disc, the same mark the Fit cards use. */
export function CheckDisc() {
  return (
    <span
      aria-hidden
      className="bg-brand-700 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white"
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none">
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Keeps `phrase` (a hyphenated word) from breaking at its hyphen. */
function NoBreak({ text, phrase }: { text: string; phrase: string }) {
  const at = text.indexOf(phrase);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="whitespace-nowrap">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  );
}

/**
 * A takeaway's lead phrase (before its first " - ") and the rest. With no
 * dash nothing is bold: the whole item reads as regular text. Render-time
 * only: the approved string is shown whole, byte for byte.
 */
function splitTakeaway(text: string): [string, string] {
  const dash = text.indexOf(" - ");
  return dash > 0 ? [text.slice(0, dash), text.slice(dash)] : ["", text];
}

/**
 * The registration hero: logo bar, the approved headline, the four GHL
 * takeaways and the form. Its own component (not ApplyHero) because the
 * masterclass left column is a takeaway list, not a paragraph.
 */
export function MasterclassHero({
  aside,
  angle,
  stats,
}: {
  aside: React.ReactNode;
  /** `?angle=` from the ad URL; unknown or missing reads the default hero. */
  angle?: string;
  stats: MasterclassEvent["anthony"];
}) {
  const copy = heroForAngle(angle);
  // One block per sentence, so the second always starts its own line.
  const sentences = copy.headline.match(/[^.]+\.\s*/g) ?? [copy.headline];
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-[#eaf6ff]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="border-ink relative border-b-2 bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center px-5 py-2 lg:px-10 lg:py-3">
          <Wordmark height={30} eager className="lg:h-11! lg:w-[146px]!" />
        </div>
      </div>
      {/* One grid, in reading order: headline, subhead, form, takeaways,
          video link. So keyboard focus reaches the form right after the
          headline. From lg the copy is top-anchored in column 1 (a fixed top
          row, a flexible bottom one) so form validation growing column 2
          never moves it, and the form spans every row of column 2. */}
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 gap-x-14 px-5 pt-3 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-[auto_auto_auto_auto_auto_auto_auto_1fr] lg:px-10 lg:py-14">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] text-balance uppercase lg:col-start-1 lg:row-start-2 lg:max-w-[620px]">
          {copy.eyebrow}
        </p>
        <h1 className="v2-display text-ink mt-2 max-w-[20ch] text-[clamp(1.8rem,4.4vw,3.6rem)] leading-[1.02] uppercase lg:col-start-1 lg:row-start-3 lg:mt-5 lg:leading-[1.14]">
          {sentences.map((sentence, index) => {
            const text = sentence.trim();
            const at = text.indexOf(copy.highlight);
            return (
              <span key={text} className="block">
                {index > 0 ? <span className="sr-only"> </span> : null}
                {at < 0 ? (
                  text
                ) : (
                  <>
                    {text.slice(0, at)}
                    <Highlight className="mc-sweep">{copy.highlight}</Highlight>
                    {text.slice(at + copy.highlight.length)}
                  </>
                )}
              </span>
            );
          })}
        </h1>
        <p className="text-ink mt-2 text-base leading-snug font-bold sm:text-lg lg:col-start-1 lg:row-start-4 lg:mt-4 lg:max-w-[620px]">
          <NoBreak text={copy.subheadline} phrase="cash-flowing" />
        </p>
        <div
          id={APPLY_QUIZ_ANCHOR}
          className="mt-2 w-full min-w-0 scroll-mt-6 self-start lg:col-start-2 lg:row-span-8 lg:row-start-1 lg:mt-0"
        >
          {aside}
        </div>
        {/* After the form in reading order, so on phones the submit stays on
            the first screen; from lg it sits beside the form. */}
        {stats ? (
          <p className="text-ink mt-5 text-sm font-bold sm:text-[15px] lg:col-start-1 lg:row-start-5 lg:mt-4 lg:max-w-[620px]">
            <span className="text-eyebrow font-black tracking-[0.1em] uppercase">
              {copy.proofLead}:
            </span>{" "}
            {stats.locations} {hostCopy.statLabels.locations.toLowerCase()}
            {" · "}
            {stats.machines} {hostCopy.statLabels.machines.toLowerCase()}
            {" · "}
            {stats.revenue} {hostCopy.statLabels.revenue.toLowerCase()}
          </p>
        ) : null}
        <div className="mt-8 max-w-[620px] lg:col-start-1 lg:row-start-6 lg:mt-6">
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            On the call
          </p>
          <ul className="mt-3 space-y-3">
            {masterclassTakeaways.map((item) => {
              const [lead, rest] = splitTakeaway(item);
              return (
                <li
                  key={item}
                  className="flex gap-3 text-[15px] leading-[1.55] font-medium text-slate-700"
                >
                  <CheckDisc />
                  <span>
                    {lead ? (
                      <strong className="text-ink font-bold">{lead}</strong>
                    ) : null}
                    {rest}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <SaveSeatLink
          href={`#${APPLY_VSL_ANCHOR}`}
          focusId={WATCH_HEADING_ID}
          className="group text-ink mt-7 inline-flex items-center gap-3 justify-self-start text-[15px] font-black tracking-[0.02em] uppercase lg:col-start-1 lg:row-start-7"
        >
          <span className="bg-brand-600 flex size-11 items-center justify-center rounded-full text-white shadow-[3px_3px_0_#111111] transition-transform group-hover:translate-y-0.5">
            <PlayIcon className="size-4 translate-x-px" />
          </span>
          <span className="decoration-brand-600 flex items-center gap-1.5 underline decoration-2 underline-offset-4">
            {copy.videoCue}
            <ChevronDownIcon className="text-eyebrow size-4 motion-safe:animate-bounce" />
          </span>
        </SaveSeatLink>
      </div>
    </section>
  );
}
