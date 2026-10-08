import { EventDateLine } from "@/components/sections/masterclass/EventDateLine";
import { LocalTimeLine } from "@/components/sections/masterclass/EventTiming";
import { CheckDisc } from "@/components/sections/masterclass/MasterclassHero";
import { Wordmark } from "@/components/site/Wordmark";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { APPLY_QUIZ_ANCHOR } from "@/lib/content/apply-page";
import { hostCopy } from "@/lib/content/masterclass";
import { qaCopy } from "@/lib/content/qa";
import type { QaEvent } from "@/lib/services/masterclass-event";

/**
 * The /qa hero: the /masterclass hero's frame and type, with a card that sends
 * people to the Zoom registration instead of a form. Zoom owns the sign-up and
 * emails each person their own join link.
 */
export function QaHero({
  event,
  renderedAt,
}: {
  event: QaEvent;
  renderedAt: number;
}) {
  const at = qaCopy.headline.indexOf(qaCopy.highlight);
  const stats = event.anthony;
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
      {/* Reading order: headline, card, details. On phones the Register
          button stays on the first screen; from lg the card spans column 2. */}
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 gap-x-14 gap-y-6 px-5 pt-6 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:grid-rows-[auto_1fr] lg:px-10 lg:py-16">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] text-balance uppercase">
            {qaCopy.eyebrow}
          </p>
          <h1 className="v2-display text-ink mt-3 max-w-[20ch] text-[clamp(1.8rem,4.4vw,3.6rem)] leading-[1.02] uppercase lg:mt-5 lg:leading-[1.14]">
            {at < 0 ? (
              qaCopy.headline
            ) : (
              <>
                {qaCopy.headline.slice(0, at)}
                <Highlight className="mc-sweep">{qaCopy.highlight}</Highlight>
              </>
            )}
          </h1>
          <p className="text-ink mt-3 text-base leading-snug font-bold sm:text-lg lg:mt-4">
            {qaCopy.subheadline}
          </p>
        </div>
        <div
          id={APPLY_QUIZ_ANCHOR}
          className="rounded-card border-ink shadow-card scroll-mt-6 self-start border-2 bg-white p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:p-8"
        >
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {qaCopy.cardEyebrow}
          </p>
          <h2 className="v2-display text-ink mt-2 text-[clamp(1.6rem,3vw,2.2rem)] leading-none uppercase">
            {qaCopy.cardHeading}
          </h2>
          {event.label ? (
            <>
              <p className="text-ink mt-4 text-lg font-bold">
                <EventDateLine
                  label={event.label}
                  startsAt={event.startsAt}
                  renderedAt={renderedAt}
                />
              </p>
              {event.startsAt ? (
                <LocalTimeLine
                  startsAt={event.startsAt}
                  className="mt-1 text-sm text-slate-600"
                />
              ) : null}
            </>
          ) : null}
          {event.registerUrl ? (
            <>
              <a
                href={event.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({
                  size: "lg",
                  className: "mt-6 w-full",
                })}
              >
                {qaCopy.cta}
              </a>
              <p className="mt-3 text-sm text-slate-600">{qaCopy.hint}</p>
            </>
          ) : (
            <p className="mt-6 text-sm font-bold text-slate-700">
              {qaCopy.noLink}
            </p>
          )}
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {stats ? (
            <p className="text-ink text-sm font-bold sm:text-[15px]">
              <span className="text-eyebrow font-black tracking-[0.1em] uppercase">
                {qaCopy.proofLead}:
              </span>{" "}
              {stats.locations} {hostCopy.statLabels.locations.toLowerCase()}
              {" · "}
              {stats.machines} {hostCopy.statLabels.machines.toLowerCase()}
              {" · "}
              {stats.revenue} {hostCopy.statLabels.revenue.toLowerCase()}
            </p>
          ) : null}
          <ul className="mt-7 max-w-[620px] space-y-3">
            {qaCopy.takeaways.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[15px] leading-[1.55] font-medium text-slate-700"
              >
                <CheckDisc />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
