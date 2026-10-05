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
      <div className="mx-auto max-w-[1440px] px-5 pt-6 lg:px-12 lg:pt-8">
        <Wordmark height={40} eager />
      </div>
      {/* Two columns across a wide 1440px frame so both the copy and the 2:1
          mockup get real width; image above the copy on phones. */}
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 pt-6 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-12 lg:px-12 lg:pt-10 lg:pb-16">
        <div className="relative z-10">
          <p className={EYEBROW}>{hero.eyebrow}</p>
          <h1 className="v2-display text-ink mt-4 text-[clamp(2.6rem,4.4vw,4.5rem)] leading-[1.02] uppercase">
            {before}
            <Highlight>{hero.highlight}</Highlight>
            {after}
          </h1>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="flex items-baseline gap-3">
              <span className="text-ink/55 text-2xl font-black line-through sm:text-3xl">
                {PRICE.anchor}
              </span>
              <span className="v2-display text-brand-700 text-6xl leading-none sm:text-7xl">
                {PRICE.today}
              </span>
            </p>
            <p className="text-base leading-tight font-bold">
              {PRICE.save}
              <span className="text-eyebrow mt-1 block text-sm font-black tracking-[0.06em] uppercase">
                {hero.availability}
              </span>
            </p>
          </div>
          <PlaybookCta
            href={checkoutHref}
            label={BUY_CTA}
            placement="hero"
            className="mt-7"
          />
          <dl className="border-ink mt-9 grid max-w-xl grid-cols-3 gap-x-5 border-t-2 pt-4">
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
        <div className="-order-1 -mx-3 lg:order-none lg:mx-0">
          <Image
            src={images.product.src}
            alt={images.product.alt}
            width={images.product.width}
            height={images.product.height}
            sizes="(min-width: 1440px) 820px, (min-width: 1024px) 55vw, 100vw"
            priority
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
