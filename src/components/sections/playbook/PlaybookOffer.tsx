import { Card } from "@/components/ui/Card";
import { Highlight } from "@/components/ui/Highlight";
import {
  BUY_CTA,
  BUY_CTA_SHORT,
  PRICE,
  curriculum,
  includedBonuses,
  moreBonuses,
  steps,
} from "@/lib/content/playbook";
import { EYEBROW, H2, PlaybookCtaBand } from "./PlaybookCta";

interface PlaybookOfferProps {
  checkoutHref: string;
}

function Points({ points }: { points: readonly string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-[0.95rem] leading-snug">
      {points.map((p) => (
        <li key={p} className="flex gap-2">
          <span aria-hidden className="bg-brand-600 mt-2 size-2 shrink-0" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlaybookSteps({ checkoutHref }: PlaybookOfferProps) {
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <h2 data-reveal className={H2}>
          {steps.title.map((t) => (
            <span key={t} className="block">
              {t}
            </span>
          ))}
        </h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2">
          {steps.items.map((s, i) => (
            <li key={s.label} data-reveal>
              <Card className="h-full">
                <p className="text-ink text-xl font-black uppercase">
                  <span className="text-brand-600">{i + 1}. </span>
                  {s.label}
                </p>
                <p className="mt-2 leading-snug">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
        <PlaybookCtaBand href={checkoutHref} label={BUY_CTA} />
      </div>
    </section>
  );
}

export function PlaybookCurriculum({ checkoutHref }: PlaybookOfferProps) {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <h2 data-reveal className={H2}>
          {curriculum.title} <Highlight>{PRICE.today}</Highlight>
        </h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-2">
          {curriculum.chapters.map((c, i) => (
            <li key={c.title} data-reveal>
              <Card className="h-full">
                <p className={EYEBROW}>CHAPTER {i + 1}</p>
                <h3 className="text-ink mt-1 text-lg leading-tight font-black uppercase">
                  {c.title}
                </h3>
                <Points points={c.points} />
              </Card>
            </li>
          ))}
        </ol>
        <div className="mt-12">
          <p className={EYEBROW}>{includedBonuses.eyebrow}</p>
          <h3 className="text-ink mt-2 text-2xl font-black uppercase">
            {includedBonuses.title}
          </h3>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {includedBonuses.items.map((b, i) => (
              <li key={b.title} data-reveal>
                <Card variant="tint" className="h-full">
                  <p className={EYEBROW}>Bonus {i + 1}</p>
                  <p className="text-ink mt-1 font-black uppercase">
                    {b.title}
                  </p>
                  <p className="mt-2 text-[0.95rem] leading-snug">{b.text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
        <PlaybookCtaBand href={checkoutHref} label={BUY_CTA} />
      </div>
    </section>
  );
}

export function PlaybookMoreBonuses({ checkoutHref }: PlaybookOfferProps) {
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <p className={EYEBROW}>{moreBonuses.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-2`}>
          {moreBonuses.title}
        </h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {moreBonuses.items.map((b, i) => (
            <li key={b.title} data-reveal>
              <Card className="h-full">
                <p className={EYEBROW}>BONUS #{i + 1}</p>
                <p className="text-ink mt-1 font-black uppercase">{b.title}</p>
                <Points points={b.points} />
              </Card>
            </li>
          ))}
        </ul>
        <PlaybookCtaBand href={checkoutHref} label={BUY_CTA_SHORT} />
      </div>
    </section>
  );
}
