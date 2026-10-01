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
  PriceTag,
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
              <span className={`${NUMERAL} text-[3.5rem]`}>{pad(i + 1)}</span>
              <p className="v2-display text-ink mt-3 text-2xl uppercase">
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
        <div className="lg:sticky lg:top-8 lg:self-start">
          <h2 data-reveal className={H2}>
            {curriculum.title} <Highlight>{PRICE.today}</Highlight>
          </h2>
          <PriceTag className="mt-8" />
          <PlaybookCta href={checkoutHref} label={BUY_CTA} className="mt-6" />
        </div>
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
                {c.lessons ? <p className={EYEBROW}>{c.lessons}</p> : null}
                <h3 className="v2-display text-ink mt-1 text-2xl leading-[1.05] text-balance uppercase">
                  {c.title}
                </h3>
                <CheckList items={c.points} className="mt-4 text-[0.95rem]" />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <IncludedBonuses />
    </section>
  );
}

/** The five chapter companions: one ruled list beside its heading. */
function IncludedBonuses() {
  return (
    <div className="mx-auto mt-20 grid max-w-[1180px] gap-8 px-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-10">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className={EYEBROW}>{includedBonuses.eyebrow}</p>
        <h3 className="v2-display text-ink mt-3 text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.02] text-balance uppercase">
          {includedBonuses.title}
        </h3>
        <PriceTag className="mt-6" />
      </div>
      <ul className="border-ink bg-ink shadow-card rounded-card grid gap-[2px] overflow-hidden border-2">
        {includedBonuses.items.map((b, i) => (
          <li
            key={b.title}
            className="bg-tint grid gap-x-6 gap-y-1 p-5 sm:grid-cols-[minmax(0,13rem)_1fr]"
          >
            <p className="text-ink leading-tight font-black uppercase">
              <span className="text-eyebrow mb-1 block text-xs tracking-[0.14em]">
                Bonus {i + 1}
              </span>
              {b.title}
            </p>
            <p className="text-[0.95rem] leading-snug sm:pt-5">{b.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Bonus = (typeof moreBonuses.items)[number];

const BONUS_EYEBROW =
  "text-eyebrow block text-xs font-black tracking-[0.14em] uppercase";
const BONUS_TITLE =
  "v2-display text-ink text-2xl leading-[1.05] text-balance uppercase";

/** md and up: every bullet, always visible. */
function BonusCell({ bonus }: { bonus: Bonus }) {
  return (
    <>
      <span className={BONUS_EYEBROW}>Bonus</span>
      <p className={`${BONUS_TITLE} mt-2`}>{bonus.title}</p>
      <CheckList items={bonus.points} className="mt-5 text-[0.95rem]" />
    </>
  );
}

/**
 * Phones: a compact row, title and first bullet in the summary, the rest
 * behind the disclosure. The first three start open.
 */
function BonusRow({ bonus, open }: { bonus: Bonus; open: boolean }) {
  const [lead, ...rest] = bonus.points;
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none gap-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className={BONUS_EYEBROW}>Bonus</span>
          <span className={`${BONUS_TITLE} mt-1.5 block`}>{bonus.title}</span>
          <span className="mt-3 flex gap-3 text-[0.95rem] leading-snug">
            <CheckIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
            <span>{lead}</span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="border-ink mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 text-lg leading-none transition-transform group-open:rotate-45 motion-reduce:transition-none"
        >
          +
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
        <p className={EYEBROW}>{moreBonuses.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-2`}>
          {moreBonuses.title}
        </h2>
        <ul className="border-ink bg-ink shadow-card rounded-card mt-10 grid gap-[2px] overflow-hidden border-2 md:grid-cols-2 lg:grid-cols-3">
          {moreBonuses.items.map((b, i) => (
            <li key={b.title} className="bg-white p-5 md:p-6 lg:p-8">
              <div className="md:hidden">
                <BonusRow bonus={b} open={i < 3} />
              </div>
              <div className="hidden md:block">
                <BonusCell bonus={b} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <PlaybookCta href={checkoutHref} label={BUY_CTA} />
        </div>
      </div>
    </section>
  );
}
