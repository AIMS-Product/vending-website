import { Fragment } from "react";
import { Highlight } from "@/components/ui/Highlight";
import {
  liveDayWord,
  showUpLiveCopy,
  withLiveDay,
} from "@/lib/content/masterclass";

/*
 * Lucide icons (ISC) inlined: lucide-react is not a dependency of this app,
 * and three paths do not justify adding one.
 */
const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "size-4 shrink-0",
} as const;

function BadgePercent() {
  return (
    <svg {...iconProps}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m15 9-6 6" />
      <path d="M9 9h.01" />
      <path d="M15 15h.01" />
    </svg>
  );
}

function Lock() {
  return (
    <svg {...iconProps}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BookOpen() {
  return (
    <svg {...iconProps}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

const ICONS = [BadgePercent, Lock, BookOpen];

/** GHL's reason to attend live: three bonuses that are not in the replay. */
export function ShowUpLive({
  startsAt,
  renderedAt,
}: {
  startsAt: string | null;
  /** Server render time (ms): "tonight" only on the event's own day. */
  renderedAt: number;
}) {
  const copy = showUpLiveCopy;
  const day = liveDayWord(renderedAt, startsAt);
  return (
    <section className="bg-tint border-ink border-y-2">
      <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 lg:px-10 lg:py-16">
        <div data-reveal>
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {copy.eyebrow}
          </p>
          <h2 className="v2-display text-ink mt-3 text-[clamp(2.1rem,3.6vw,3rem)] leading-[1.02] text-balance uppercase">
            {copy.heading}
            {/* One block per phrase: a wrapped Highlight fills the column. */}
            {copy.highlight.map((phrase, index) => (
              <Fragment key={phrase}>
                {index ? " " : null}
                <Highlight className="my-0 leading-[1.02]">{phrase}</Highlight>
              </Fragment>
            ))}
          </h2>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-slate-700">
            {withLiveDay(copy.bodyLead, day)}
            <strong className="text-ink font-black">{copy.bodyStrong}</strong>
            {copy.bodyTail}
          </p>
        </div>
        <div data-reveal>
          {/* One flat list, outlined icons: the page already stacks card
              groups, and the bonuses read better as a single checklist. */}
          <ul className="rounded-card border-ink border-2 bg-white">
            {copy.bonuses.map((bonus, index) => {
              const Icon = ICONS[index];
              return (
                <li
                  key={bonus.title}
                  className="flex gap-3 border-b border-slate-200 p-4 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className="border-ink text-ink grid size-8 shrink-0 place-items-center rounded-md border-2 bg-white"
                  >
                    {Icon ? <Icon /> : null}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className="v2-display text-ink block text-[1.35rem] leading-none uppercase">
                      {bonus.title}
                    </span>
                    <span className="mt-1.5 block text-[15px] leading-snug text-slate-600">
                      {withLiveDay(bonus.body, day)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {/* copy.closing ("These won't be in the replay.") is not rendered:
              the body above already says it. */}
        </div>
      </div>
    </section>
  );
}
