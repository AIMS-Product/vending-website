import Image from "next/image";
import { SubscribeForm } from "@/components/SubscribeForm";
import { hero, stats } from "@/lib/content";

export function Hero() {
  return (
    <section className="border-b border-rule">
      {/* Everything above the field is on a budget below 400px: the brief's
          subhead plus the "Join Entrepreneurship Collective." label is a lot
          of type to clear before the fold on a 568px-tall phone. */}
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pt-6 pb-12 sm:px-8 sm:pt-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pt-16 lg:pb-20">
        <div>
          <p className="eyebrow flex items-center gap-3 text-accent">
            <span aria-hidden className="h-px w-8 bg-accent" />
            {hero.eyebrow}
          </p>

          <h1 className="font-display mt-4 max-w-2xl text-[2.6rem] leading-[1.02] text-balance max-[400px]:text-[2.35rem] sm:mt-5 sm:text-6xl lg:text-[4rem]">
            {hero.heading}
          </h1>

          {/* The front half of the brief's subhead. The whole sentence is
              intact further down, in "What you get". */}
          <p className="mt-4 max-w-lg text-lg leading-7 text-ink-muted max-[400px]:text-base max-[400px]:leading-6 sm:mt-5 sm:text-xl sm:leading-8">
            {hero.subhead}
          </p>

          {/* The signup is a defined module, not loose controls on the page.
              A hairline card is enough to make it the thing the eye lands on
              after the headline — anything heavier and it stops looking like
              a publication. */}
          <div className="mt-6 max-w-lg rounded-lg border border-rule-strong bg-paper-raised p-4 sm:mt-7 sm:p-6">
            <SubscribeForm
              id="subscribe"
              source="hero"
              label={hero.formLabel}
              note={hero.formNote}
            />
            <p className="mt-3 flex items-baseline gap-2.5 border-t border-rule pt-3 text-sm text-ink-muted">
              <span
                aria-hidden
                className="inline-block size-1.5 shrink-0 translate-y-[-0.15em] rounded-full bg-accent"
              />
              {hero.proofLine}
            </p>
          </div>
        </div>

        {/* Capped between phone and desktop: left uncapped, the square portrait
            eats 736px of scroll on a 768px tablet for no extra information. */}
        <div className="relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:max-w-none lg:justify-self-end">
          {/* A single offset wash behind the frame. It gives the portrait an
              edge to sit against without borrowing the Vendingpreneurs
              hard-shadow, which would drag the orange language along with it. */}
          <div
            aria-hidden
            className="absolute -right-3 -bottom-3 hidden h-full w-full rounded-lg bg-accent-wash sm:block"
          />
          <figure className="relative">
            <Image
              src="/images/mike-hoffmann.webp"
              alt="Mike Hoffmann seated in a rattan chair, holding a tablet."
              width={720}
              height={720}
              priority
              fetchPriority="high"
              sizes="(min-width: 1024px) 460px, (min-width: 640px) 416px, 100vw"
              className="aspect-square w-full rounded-lg border border-rule-strong object-cover"
            />
            <figcaption className="mt-3 text-[0.8125rem] text-ink-subtle">
              {hero.portraitCaption}
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="border-t border-rule">
        <dl className="mx-auto grid w-full max-w-6xl px-6 sm:grid-cols-3 sm:px-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={[
                "py-5 sm:py-6",
                index > 0 ? "border-t border-rule sm:border-t-0" : "",
                "sm:border-l sm:pl-6 sm:first:border-l-0 sm:first:pl-0",
              ].join(" ")}
            >
              <dd className="font-display text-2xl tabular-nums sm:text-3xl">
                {stat.value}
              </dd>
              <dt className="eyebrow mt-1 text-ink-subtle">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
