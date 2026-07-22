import Image from "next/image";
import { applyTestimonials } from "@/lib/content/apply-page";
import { StarRow } from "./icons";

export function ApplyTestimonials() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-24 lg:px-10">
      <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyTestimonials.eyebrow}
      </p>
      <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
        {applyTestimonials.title}
      </h2>

      <ul className="mt-12 grid gap-6 lg:grid-cols-3">
        {applyTestimonials.shortQuotes.map((quote) => (
          <li
            key={quote.name}
            className="flex flex-col gap-4 rounded-[14px] border-2 border-[#111111] bg-white p-6 shadow-[6px_6px_0_#55b8e8]"
          >
            {quote.image ? (
              <div className="flex items-center gap-3.5">
                <Image
                  src={quote.image}
                  alt={quote.name}
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-[12px] border-2 border-[#111111] object-cover"
                />
                <div>
                  <StarRow
                    className="flex gap-0.5 text-[#f4c236]"
                    starClassName="size-4"
                  />
                  <p className="mt-1 text-[15px] font-semibold text-[#111111]">
                    {quote.name}
                  </p>
                </div>
              </div>
            ) : (
              // No headshot yet — name-forward layout, no avatar placeholder.
              <div>
                <StarRow
                  className="flex gap-0.5 text-[#f4c236]"
                  starClassName="size-4"
                />
                <p className="mt-1.5 text-[15px] font-black tracking-wide text-[#111111] uppercase">
                  {quote.name}
                </p>
              </div>
            )}
            <p className="text-[17px] leading-snug font-black text-[#111111]">
              {quote.quote}
            </p>
          </li>
        ))}
      </ul>

      <figure className="mt-7 flex flex-wrap items-center gap-6 rounded-[14px] border-2 border-[#111111] bg-[#111111] px-8 py-7 shadow-[6px_6px_0_#f47b3b]">
        <StarRow
          className="flex shrink-0 gap-0.5 text-[#f47b3b]"
          starClassName="size-[18px]"
        />
        <blockquote className="min-w-[280px] flex-1 text-xl leading-snug font-black text-white">
          {applyTestimonials.featured.quote}
        </blockquote>
        <figcaption className="text-sm font-semibold text-white/70">
          {applyTestimonials.featured.attribution}
        </figcaption>
      </figure>

      <h3 className="mt-16 mb-7 text-[clamp(1.3rem,2vw,1.7rem)] font-black text-[#111111] uppercase">
        {applyTestimonials.moreTitle}
      </h3>
      <ul className="grid gap-6 sm:grid-cols-2">
        {applyTestimonials.reviews.map((review) => (
          <li
            key={review.name}
            className="rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[6px_6px_0_#55b8e8]"
          >
            <h4 className="text-base font-black tracking-wide text-[#111111] uppercase">
              {review.name}
            </h4>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {review.org}
            </p>
            <StarRow
              className="mt-3.5 mb-3.5 flex gap-0.5 text-[#f47b3b]"
              starClassName="size-[18px]"
            />
            <p className="text-[15px] leading-relaxed font-semibold text-slate-700">
              {review.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
