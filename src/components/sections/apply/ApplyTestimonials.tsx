import Image from "next/image";
import { applyTestimonials } from "@/lib/content/apply-page";

// "What people are saying" — a grid of pre-rendered member review cards
// (3 rows of 2 on desktop), capped with the wide Madison splitter banner. The
// cards are finished graphics from Kody; more get appended to
// applyTestimonials.cards over time. Each card's quote is carried in the image
// alt so screen readers get the testimonial text.
export function ApplyTestimonials() {
  const { cards, splitter } = applyTestimonials;
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-24 lg:px-10">
      <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyTestimonials.eyebrow}
      </p>
      <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
        {applyTestimonials.title}
      </h2>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.name} className="min-w-0">
            <Image
              src={card.image}
              alt={card.alt}
              width={2019}
              height={838}
              sizes="(min-width: 640px) 560px, 100vw"
              className="h-auto w-full rounded-[14px]"
            />
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Image
          src={splitter.image}
          alt={splitter.alt}
          width={4330}
          height={620}
          sizes="(min-width: 1024px) 1120px, 100vw"
          className="h-auto w-full rounded-[14px]"
        />
      </div>
    </section>
  );
}
