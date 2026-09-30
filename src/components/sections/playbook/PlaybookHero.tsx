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
    <section className="border-ink v2-dots relative overflow-hidden border-b-2 bg-white">
      <div className="mx-auto grid max-w-[1180px] items-center gap-6 px-5 pt-10 pb-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-4 lg:px-10 lg:pt-16 lg:pb-16">
        <div className="relative z-10">
          <p className={EYEBROW}>{hero.eyebrow}</p>
          <h1 className="v2-display text-ink mt-4 text-[clamp(2.6rem,4.6vw,4rem)] leading-[1.02] uppercase">
            {before}
            <Highlight>{hero.highlight}</Highlight>
            {after}
          </h1>
          <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="flex items-baseline gap-3">
              <span className="text-ink/55 text-2xl font-black line-through">
                {PRICE.anchor}
              </span>
              <span className="v2-display text-brand-700 text-6xl leading-none">
                {PRICE.today}
              </span>
            </p>
            <p className="pb-1 text-sm leading-tight font-bold">
              {PRICE.save}
              <span className="text-eyebrow block font-black uppercase">
                {hero.availability}
              </span>
            </p>
          </div>
          <PlaybookCta
            href={checkoutHref}
            label={BUY_CTA}
            className="mt-6 w-full sm:w-auto"
          />
          <dl className="border-ink mt-9 grid max-w-md grid-cols-3 border-t-2 pt-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="v2-display text-ink block text-3xl leading-none">
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
        {/* The artwork has its own transparent margin; let it run past the
            column edge on desktop so the product reads at poster size. */}
        <div className="-order-1 -mx-3 lg:order-none lg:-mr-24 lg:ml-0">
          <Image
            src={images.product.src}
            alt={images.product.alt}
            width={images.product.width}
            height={images.product.height}
            sizes="(min-width: 1024px) 820px, 100vw"
            priority
            className="h-auto w-full lg:scale-110"
          />
        </div>
      </div>
    </section>
  );
}
