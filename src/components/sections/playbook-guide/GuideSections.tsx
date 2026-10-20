import Image from "next/image";
import { Wordmark } from "@/components/site/Wordmark";
import { Highlight } from "@/components/ui/Highlight";
import {
  CheckIcon,
  CheckList,
  EYEBROW,
  H2,
  NUMERAL,
} from "@/components/sections/playbook/PlaybookCta";
import { GUIDE, guideOffer, plays } from "@/lib/content/playbook-guide";
import { guideImages } from "@/lib/content/playbook-guide-images";

interface BuyProps {
  buy: React.ReactNode;
}

export function GuideHero({ buy, notice }: BuyProps & { notice?: string }) {
  const [before, after] = guideOffer.headline.split(guideOffer.highlight);
  return (
    <section className="border-ink v2-dots relative overflow-hidden border-b-2 bg-white">
      <div className="mx-auto max-w-[1240px] px-5 pt-6 lg:px-12 lg:pt-8">
        <Wordmark height={36} eager />
      </div>
      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pt-6 pb-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:px-12 lg:pt-10 lg:pb-20">
        <div className="relative z-10">
          {notice ? (
            <p
              role="alert"
              className="border-ink bg-ui-warn-fill text-ui-warn-ink mb-5 border-2 px-4 py-3 text-sm font-bold"
            >
              {notice}
            </p>
          ) : null}
          <p className={EYEBROW}>{guideOffer.eyebrow}</p>
          <h1 className="v2-display text-ink mt-4 text-[clamp(2.5rem,5vw,4.4rem)] leading-[1.02] uppercase">
            {before}
            <Highlight className="whitespace-normal">
              {guideOffer.highlight}
            </Highlight>
            {after}
          </h1>
          <p className="text-ink/80 mt-5 max-w-xl text-lg leading-snug">
            {guideOffer.sub}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="v2-display text-brand-700 text-6xl leading-none">
              {GUIDE.priceLabel}
            </span>
            {buy}
          </div>
          <p className="text-ink/65 mt-3 text-sm font-bold">
            {guideOffer.ctaNote}
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-[380px] lg:max-w-[420px]">
          <div
            aria-hidden
            className="bg-brand-200 border-ink absolute inset-0 translate-x-4 translate-y-4 border-2"
          />
          <Image
            src={guideImages.cover.src}
            alt={guideImages.cover.alt}
            width={guideImages.cover.width}
            height={guideImages.cover.height}
            sizes="(min-width: 1024px) 420px, 380px"
            priority
            className="border-ink relative h-auto w-full -rotate-2 border-2 bg-white shadow-[8px_8px_0_#111111]"
          />
        </div>
      </div>
    </section>
  );
}

export function GuideBenefits() {
  return (
    <section className="border-ink border-b-2 bg-white">
      <div className="mx-auto max-w-[1240px] px-5 py-14 lg:px-12 lg:py-20">
        <h2 className={H2}>What you&rsquo;ll walk away with</h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {guideOffer.benefits.map((b, i) => (
            <li
              key={b.title}
              className="border-ink bg-brand-50 border-2 p-6 shadow-[6px_6px_0_#111111]"
            >
              <span className={`${NUMERAL} text-5xl`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-ink mt-3 text-xl font-black">{b.title}</h3>
              <p className="text-ink/80 mt-2 leading-snug">{b.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function GuideInside() {
  return (
    <section className="border-ink bg-brand-50 border-b-2">
      <div className="mx-auto max-w-[1240px] px-5 py-14 lg:px-12 lg:py-20">
        <p className={EYEBROW}>{guideOffer.previewTitle}</p>
        <h2 className={`${H2} mt-3`}>Real pages from the playbook</h2>
        <ul className="mt-10 grid grid-cols-3 gap-3 sm:gap-6">
          {guideImages.previews.map((page) => (
            <li key={page.src}>
              <Image
                src={page.src}
                alt={page.alt}
                width={page.width}
                height={page.height}
                sizes="(min-width: 1240px) 380px, 33vw"
                className="border-ink h-auto w-full border-2 bg-white shadow-[5px_5px_0_#111111]"
              />
            </li>
          ))}
        </ul>
        <h3 className="v2-display text-ink mt-16 text-3xl uppercase">
          {guideOffer.contentsTitle}
        </h3>
        <ol className="border-ink mt-6 divide-y-2 divide-[#111111] border-2 bg-white">
          {plays.map((play) => (
            <li
              key={play.number}
              className="flex gap-5 px-5 py-4 sm:items-center"
            >
              <span className={`${NUMERAL} w-12 shrink-0 text-4xl`}>
                {play.number}
              </span>
              <div>
                <p className="text-ink text-lg font-black">{play.title}</p>
                <p className="text-ink/75 leading-snug">{play.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function GuideFinalOffer({ buy }: BuyProps) {
  return (
    <section className="v2-dots bg-white">
      <div className="mx-auto max-w-[860px] px-5 py-14 lg:py-20">
        <div className="border-ink border-2 bg-white p-6 shadow-[8px_8px_0_#111111] sm:p-10">
          <p className={EYEBROW}>Everything inside</p>
          <h2 className="v2-display text-ink mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1.04] uppercase">
            {GUIDE.title}
          </h2>
          <CheckList
            items={guideOffer.includes}
            className="mt-6 text-lg font-bold"
          />
          <div className="border-ink mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-t-2 pt-6">
            <span className="v2-display text-brand-700 text-6xl leading-none">
              {GUIDE.priceLabel}
            </span>
            {buy}
          </div>
          <ul className="text-ink/75 mt-8 space-y-2 text-sm">
            {[...guideOffer.terms, guideOffer.refundTerms].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-ink/55 mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed">
          {guideOffer.disclaimer}
        </p>
      </div>
    </section>
  );
}
