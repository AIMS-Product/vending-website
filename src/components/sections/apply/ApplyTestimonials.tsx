import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { applyTestimonials } from "@/lib/content/apply-page";

// "What people are saying": six review cards in a 2-up grid, capped with the
// wide Madison spotlight (the page's one ink card). Real text, so a quote is
// as readable at 390 as at 1440.
export function ApplyTestimonials() {
  const { cards, spotlight } = applyTestimonials;
  return (
    <Section>
      <p className="text-eyebrow text-center text-xs font-black tracking-[0.14em] uppercase">
        {applyTestimonials.eyebrow}
      </p>
      <h2 className="text-ink mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black uppercase">
        {applyTestimonials.title}
      </h2>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2">
        {cards.map((card) => (
          <Card as="li" key={card.name} className="flex min-w-0 flex-col">
            <figure className="flex h-full flex-col">
              <figcaption className="flex items-center gap-4">
                <Headshot src={card.headshot} />
                <span>
                  <span className="text-ink block text-lg leading-tight font-black">
                    {card.name}
                  </span>
                  <Stars />
                </span>
              </figcaption>
              <blockquote className="mt-4 text-[16px] leading-[1.6] font-medium text-slate-700">
                &ldquo;{card.quote}&rdquo;
              </blockquote>
            </figure>
          </Card>
        ))}
      </ul>

      <Card variant="ink" className="mt-6">
        <figure className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center lg:gap-10">
          <figcaption className="flex items-center gap-4">
            <Headshot src={spotlight.headshot} />
            <span>
              <span className="block text-lg leading-tight font-black">
                {spotlight.name}
              </span>
              <span className="text-sky mt-1 block text-sm font-bold">
                {spotlight.stat}
              </span>
            </span>
          </figcaption>
          <blockquote className="text-[16px] leading-[1.6] font-medium text-white/90">
            &ldquo;{spotlight.quote}&rdquo;
          </blockquote>
        </figure>
      </Card>
    </Section>
  );
}

function Headshot({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={64}
      height={64}
      className="border-ink size-16 shrink-0 rounded-full border-2 bg-white object-cover"
    />
  );
}

function Stars() {
  return (
    <span
      className="mt-1.5 flex gap-0.5"
      role="img"
      aria-label="5 out of 5 stars"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="size-4" aria-hidden>
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z"
            fill="#2a8fcc"
            stroke="#111111"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
