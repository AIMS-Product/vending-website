import Image from "next/image";
import { SubscribeForm } from "@/components/SubscribeForm";
import { hero, stats } from "@/lib/content";

export function Hero() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
        <div>
          <p className="eyebrow flex items-center gap-3 text-accent">
            <span aria-hidden className="h-px w-8 bg-accent" />
            {hero.eyebrow}
          </p>

          <h1 className="font-display mt-6 max-w-2xl text-[2.75rem] leading-[1.03] text-balance sm:text-6xl lg:text-[4rem]">
            {hero.heading}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-ink-muted">
            {hero.subhead}
          </p>

          <div className="mt-9 max-w-lg">
            <SubscribeForm
              id="subscribe"
              source="hero"
              note={hero.formNote}
            />
          </div>
        </div>

        <div className="relative lg:justify-self-end">
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
              sizes="(min-width: 1024px) 460px, 100vw"
              className="aspect-square w-full rounded-lg border border-rule-strong object-cover"
            />
            <figcaption className="mt-3 text-[0.8125rem] text-ink-subtle">
              {hero.portraitCaption}
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="border-t border-rule">
        <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 px-6 sm:px-8 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={[
                "py-6",
                // 2×2 on mobile, one row on desktop. The rules are drawn per
                // cell rather than with divide-* so the mobile row break and
                // the desktop columns can disagree about where lines go.
                index % 2 === 1 ? "border-l border-rule pl-5" : "",
                index >= 2 ? "border-t border-rule" : "",
                "md:border-t-0 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-0",
              ].join(" ")}
            >
              <dd className="font-display text-3xl tabular-nums">
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
