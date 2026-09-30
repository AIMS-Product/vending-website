import Image from "next/image";
import { Highlight } from "@/components/ui/Highlight";
import {
  BUY_CTA,
  BUY_CTA_SHORT,
  PRICE,
  curriculum,
  images,
  includedBonuses,
  moreBonuses,
  steps,
} from "@/lib/content/playbook";
import { CheckList, EYEBROW, H2, NUMERAL, PlaybookCta } from "./PlaybookCta";

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
          <div className="bg-tint border-ink shadow-card rounded-card mt-8 border-2 p-4">
            <Image
              src={images.product.src}
              alt=""
              width={images.product.width}
              height={images.product.height}
              sizes="(min-width: 1024px) 460px, 100vw"
              className="h-auto w-full"
            />
          </div>
          <PlaybookCta
            href={checkoutHref}
            label={BUY_CTA}
            className="mt-8 w-full sm:w-auto"
          />
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
              <div>
                <h3 className="text-ink pt-1 text-lg leading-tight font-black uppercase">
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
      <div>
        <p className={EYEBROW}>{includedBonuses.eyebrow}</p>
        <h3 className="v2-display text-ink mt-3 text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.02] uppercase">
          {includedBonuses.title}
        </h3>
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

/** Nine bonuses as one spec sheet: ink rules between cells, not nine cards. */
export function PlaybookMoreBonuses({ checkoutHref }: PlaybookOfferProps) {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={EYEBROW}>{moreBonuses.eyebrow}</p>
            <h2 data-reveal className={`${H2} mt-2`}>
              {moreBonuses.title}
            </h2>
          </div>
          <PlaybookCta href={checkoutHref} label={BUY_CTA_SHORT} />
        </div>
        <ul className="border-ink bg-ink shadow-card rounded-card mt-10 grid gap-[2px] overflow-hidden border-2 md:grid-cols-2 lg:grid-cols-3">
          {moreBonuses.items.map((b, i) => (
            <li key={b.title} className="bg-white p-6 lg:p-8">
              <span className={`${NUMERAL} text-[2.75rem]`}>
                <span className="sr-only">Bonus #</span>
                {pad(i + 1)}
              </span>
              <p className="v2-display text-ink mt-3 text-2xl leading-[1.05] uppercase">
                {b.title}
              </p>
              <CheckList items={b.points} className="mt-5 text-[0.95rem]" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
