import Image from "next/image";
import { Wordmark } from "@/components/site/Wordmark";
import { Highlight } from "@/components/ui/Highlight";
import { BUY_CTA, PRICE, hero, images, stats } from "@/lib/content/playbook";
import { EYEBROW, PlaybookCta } from "./PlaybookCta";

interface PlaybookHeroProps {
  checkoutHref: string;
}

export function PlaybookHero({ checkoutHref }: PlaybookHeroProps) {
  const [before, after] = hero.headline.split(hero.highlight);
  return (
    <section className="border-ink v2-dots relative overflow-hidden border-b-2 bg-white">
      {/* Brand bar: the logo only, not a link out of a paid-traffic page. */}
      <div className="mx-auto flex max-w-[1180px] justify-center px-5 pt-6 lg:px-10 lg:pt-8">
        <Wordmark height={40} eager />
      </div>
      {/* Stacked and centered: copy, price, buy button, then the full-width
          mockup (it is 2:1, so a side column shrank it), then the proof row. */}
      <div className="mx-auto flex max-w-[1180px] flex-col items-center px-5 pt-8 pb-12 text-center lg:px-10 lg:pt-10 lg:pb-16">
        <p className={EYEBROW}>{hero.eyebrow}</p>
        <h1 className="v2-display text-ink mt-4 max-w-[16ch] text-[clamp(2.6rem,6.2vw,5.25rem)] leading-[1.02] text-balance uppercase">
          {before}
          <Highlight>{hero.highlight}</Highlight>
          {after}
        </h1>
        <p className="mt-7 flex items-baseline justify-center gap-4">
          <span className="text-ink/55 text-3xl font-black line-through">
            {PRICE.anchor}
          </span>
          <span className="v2-display text-brand-700 text-7xl leading-none sm:text-8xl">
            {PRICE.today}
          </span>
        </p>
        <p className="mt-3 text-base leading-tight font-bold">
          {PRICE.save}
          <span className="text-eyebrow mt-1 block text-sm font-black tracking-[0.08em] uppercase">
            {hero.availability}
          </span>
        </p>
        <PlaybookCta
          href={checkoutHref}
          label={BUY_CTA}
          placement="hero"
          className="mt-7"
        />
        <div className="-mx-3 mt-8 w-[calc(100%+1.5rem)] max-w-[960px] sm:mx-0 sm:w-full lg:mt-10">
          <Image
            src={images.product.src}
            alt={images.product.alt}
            width={images.product.width}
            height={images.product.height}
            sizes="(min-width: 1024px) 960px, 100vw"
            priority
            className="h-auto w-full"
          />
        </div>
        <dl className="border-ink mt-8 grid w-full max-w-2xl grid-cols-3 gap-x-5 border-t-2 pt-5">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="v2-display text-ink block text-3xl leading-none sm:text-4xl">
                  {s.value}
                </span>
                <span className="text-eyebrow mt-1.5 block text-xs font-black tracking-[0.1em] uppercase">
                  {s.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
