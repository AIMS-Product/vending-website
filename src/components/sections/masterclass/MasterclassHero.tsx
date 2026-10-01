import { APPLY_QUIZ_ANCHOR, APPLY_VSL_ANCHOR } from "@/lib/content/apply-page";
import { ChevronDownIcon, PlayIcon } from "@/components/sections/apply/icons";
import { Wordmark } from "@/components/site/Wordmark";
import { Highlight } from "@/components/ui/Highlight";
import {
  masterclassHero,
  masterclassTakeaways,
} from "@/lib/content/masterclass";

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
 * The registration hero: logo bar, the approved headline, the four GHL
 * takeaways and the form. Its own component (not ApplyHero) because the
 * masterclass left column is a takeaway list, not a paragraph.
 */
export function MasterclassHero({ aside }: { aside: React.ReactNode }) {
  const copy = masterclassHero;
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
        <div className="mx-auto flex max-w-[1180px] items-center px-5 py-3 lg:px-10">
          <Wordmark height={44} eager />
        </div>
      </div>
      {/* Below lg the left column dissolves (contents) so the form can sit
          right under the subhead and the takeaways follow it. */}
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-x-14 px-5 py-12 lg:grid-cols-[1fr_minmax(0,440px)] lg:px-10 lg:py-14">
        <div className="contents lg:block lg:max-w-[620px] lg:min-w-0">
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] text-balance uppercase">
            {copy.eyebrow}
          </p>
          <h1 className="v2-display text-ink mt-5 max-w-[20ch] text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.14] uppercase">
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
                      <Highlight>{copy.highlight}</Highlight>
                      {text.slice(at + copy.highlight.length)}
                    </>
                  )}
                </span>
              );
            })}
          </h1>
          <p className="text-ink mt-4 text-lg leading-snug font-bold">
            <NoBreak text={copy.subheadline} phrase="cash-flowing" />
          </p>
          <ul className="order-3 mt-8 grid max-w-[620px] gap-3.5 lg:order-none lg:mt-6">
            {masterclassTakeaways.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[15px] leading-[1.55] font-medium text-slate-700"
              >
                <CheckDisc />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <a
            href={`#${APPLY_VSL_ANCHOR}`}
            className="group text-ink order-3 mt-7 inline-flex items-center gap-3 justify-self-start text-[15px] font-black tracking-[0.02em] uppercase lg:order-none"
          >
            <span className="bg-brand-600 flex size-11 items-center justify-center rounded-full text-white shadow-[3px_3px_0_#111111] transition-transform group-hover:translate-y-0.5">
              <PlayIcon className="size-4 translate-x-px" />
            </span>
            <span className="decoration-brand-600 flex items-center gap-1.5 underline decoration-2 underline-offset-4">
              {copy.videoCue}
              <ChevronDownIcon className="text-eyebrow size-4 motion-safe:animate-bounce" />
            </span>
          </a>
        </div>
        <div
          id={APPLY_QUIZ_ANCHOR}
          className="order-2 mt-6 w-full min-w-0 scroll-mt-6 lg:order-none lg:mt-0"
        >
          {aside}
        </div>
      </div>
    </section>
  );
}
