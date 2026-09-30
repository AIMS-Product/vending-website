import Image from "next/image";
import { Highlight } from "@/components/ui/Highlight";
import { BUY_CTA, PRICE, hero, images, stats } from "@/lib/content/playbook";
import { EYEBROW, PlaybookCta } from "./PlaybookCta";

interface PlaybookHeroProps {
  checkoutHref: string;
}

export function PlaybookHero({ checkoutHref }: PlaybookHeroProps) {
  const [before, after] = hero.headline.split(hero.highlight);
  return (
    <section className="border-ink overflow-hidden border-b-2 bg-white">
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:px-10 lg:py-20">
        <div>
          <p className={EYEBROW}>{hero.eyebrow}</p>
          <h1 className="text-ink mt-3 text-[clamp(2rem,5vw,3.6rem)] leading-[1.1] font-black uppercase">
            {before}
            <Highlight>{hero.highlight}</Highlight>
            {after}
          </h1>
          <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-ink/60 text-2xl font-black line-through">
              {PRICE.anchor}
            </span>
            <span className="text-brand-700 text-5xl font-black">
              {PRICE.today}
            </span>
            <span className="text-ink text-sm font-black uppercase">Today</span>
          </p>
          <p className="text-ink mt-1 text-sm font-bold">{PRICE.save}</p>
          <p className="text-eyebrow mt-1 text-sm font-black uppercase">
            {hero.availability}
          </p>
          <div className="mt-7">
            <PlaybookCta href={checkoutHref} label={BUY_CTA} />
          </div>
        </div>
        <Image
          src={images.product.src}
          alt={images.product.alt}
          width={images.product.width}
          height={images.product.height}
          sizes="(min-width: 1024px) 760px, 100vw"
          priority
          // The artwork carries wide transparent margins; scale past them.
          className="h-auto w-full scale-110 lg:scale-[1.3]"
        />
      </div>
      <dl className="border-ink grid grid-cols-3 border-t-2">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-5 text-center">
            <dt className="sr-only">{s.label}</dt>
            <dd className="text-ink text-2xl font-black sm:text-3xl">
              {s.value}
              <span className="text-eyebrow mt-1 block text-[0.65rem] tracking-[0.12em] uppercase sm:text-xs">
                {s.label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
