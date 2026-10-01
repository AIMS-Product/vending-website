import { Highlight } from "@/components/ui/Highlight";
import {
  BUY_CTA,
  PRICE,
  curriculum,
  includedBonuses,
  moreBonuses,
  steps,
} from "@/lib/content/playbook";
import {
  CheckIcon,
  CheckList,
  EYEBROW,
  H2,
  NUMERAL,
  PlaybookCta,
} from "./PlaybookCta";

interface PlaybookOfferProps {
  checkoutHref: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Find it, close it, run it, repeat it: four steps read left to right. */
export function PlaybookSteps() {
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <h2 data-reveal className={H2}>
          {steps.title.map((t, i) => (
            <span
              key={t}
              className={i === 1 ? "text-brand-700 block" : "block"}
            >
              {t}
            </span>
          ))}
        </h2>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.items.map((s, i) => (
            <li
              key={s.label}
              data-reveal
              style={{ "--v2-delay": `${i * 0.08}s` } as React.CSSProperties}
              className="border-ink border-t-2 pt-5"
            >
              <span className="bg-brand-700 rounded-control v2-display grid size-8 place-items-center text-base leading-none text-white tabular-nums">
                {i + 1}
              </span>
              <p className="v2-display text-ink mt-4 text-2xl uppercase">
                {s.label}
              </p>
              <p className="mt-2 leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PlaybookCurriculum({ checkoutHref }: PlaybookOfferProps) {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-10">
        {/* Phones: "contents" lets the heading lead and the CTA follow the
            included list; lg: one sticky column. */}
        <div className="contents lg:sticky lg:top-8 lg:block lg:self-start">
          <h2 data-reveal className={H2}>
            {curriculum.title} <Highlight>{PRICE.today}</Highlight>
          </h2>
          <div className="order-last lg:order-none">
            <PlaybookCta
              href={checkoutHref}
              label={BUY_CTA}
              placement="offer"
              className="lg:mt-8"
            />
          </div>
        </div>
        <div>
          <ol className="border-ink border-b-2">
            {curriculum.chapters.map((c, i) => (
              <li
                key={c.title}
                data-reveal
                className="border-ink grid grid-cols-[3.5rem_1fr] gap-x-5 border-t-2 py-7 sm:grid-cols-[4.5rem_1fr]"
              >
                <span className={`${NUMERAL} text-[3rem] sm:text-[3.75rem]`}>
                  <span className="sr-only">Chapter </span>
                  {pad(i + 1)}
                </span>
                <div className="pt-1">
                  {c.lessons ? (
                    <p className={`${EYEBROW} mb-1`}>{c.lessons}</p>
                  ) : null}
                  <h3 className="v2-display text-ink text-2xl leading-[1.05] text-balance uppercase">
                    {c.title}
                  </h3>
                  <CheckList items={c.points} className="mt-4 text-[0.95rem]" />
                </div>
              </li>
            ))}
          </ol>
          <IncludedList />
        </div>
      </div>
    </section>
  );
}

/** The five chapter companions: one compact bordered list under chapter 07. */
function IncludedList() {
  return (
    <>
      <p className="text-eyebrow mt-8 text-xs font-black tracking-[0.14em] uppercase">
        Included with the course
      </p>
      <ul className="border-ink rounded-card divide-ink mt-3 divide-y-2 border-2 bg-white">
        {includedBonuses.items.map((b) => (
          <li key={b.title} className="px-5 py-4 text-[0.95rem] leading-snug">
            <strong className="text-ink block font-bold">{b.title}</strong>{" "}
            {b.text}
          </li>
        ))}
      </ul>
    </>
  );
}

const BONUS_EYEBROW =
  "text-eyebrow block text-xs font-black tracking-[0.14em] uppercase";
const BONUS_TITLE =
  "v2-display text-ink text-2xl leading-[1.05] text-balance uppercase";

type Bonus = (typeof moreBonuses.items)[number];

/** md and up: every bullet, always visible. */
function BonusCell({ bonus, index }: { bonus: Bonus; index: number }) {
  return (
    <>
      <span className={BONUS_EYEBROW}>{`Bonus #${index + 1}`}</span>
      <h3 className={`${BONUS_TITLE} mt-2`}>{bonus.title}</h3>
      <CheckList items={bonus.points} className="mt-5 text-[0.95rem]" />
    </>
  );
}

/**
 * Phones: a compact row, title and first bullet in the summary, the rest
 * behind the disclosure. Only the first starts open.
 */
function BonusRow({
  bonus,
  index,
  open,
}: {
  bonus: Bonus;
  index: number;
  open: boolean;
}) {
  const [lead, ...rest] = bonus.points;
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none gap-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <span className={BONUS_EYEBROW}>{`Bonus #${index + 1}`}</span>
          <h3 className={`${BONUS_TITLE} mt-1.5`}>{bonus.title}</h3>
          <span className="mt-3 flex gap-3 text-[0.95rem] leading-snug">
            <CheckIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
            <span>{lead}</span>
          </span>
        </div>
        <span
          aria-hidden="true"
          className="border-ink mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2"
        >
          {/* lucide ChevronDown (the package is not a dependency here). */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <CheckList items={rest} className="mt-2.5 pr-12 text-[0.95rem]" />
    </details>
  );
}

/** Nine bonuses as one spec sheet: ink rules between cells, not nine cards. */
export function PlaybookMoreBonuses({ checkoutHref }: PlaybookOfferProps) {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <p className={`${EYEBROW} mb-3`}>{moreBonuses.eyebrow}</p>
        <h2 data-reveal className={H2}>
          {moreBonuses.title}
        </h2>
        <ul className="border-ink bg-ink shadow-card rounded-card mt-10 grid gap-[2px] overflow-hidden border-2 md:grid-cols-2 lg:grid-cols-3">
          {moreBonuses.items.map((b, i) => (
            <li key={b.title} className="bg-white p-5 md:p-6 lg:p-8">
              <div className="md:hidden">
                <BonusRow bonus={b} index={i} open={i === 0} />
              </div>
              <div className="hidden md:block">
                <BonusCell bonus={b} index={i} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <PlaybookCta href={checkoutHref} label={BUY_CTA} placement="offer" />
        </div>
      </div>
    </section>
  );
}
