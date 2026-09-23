import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import {
  QuoteTestimonialCard,
  VideoTestimonialCard,
} from "@/components/sections/Testimonials";
import { caseStudyQuotes, caseStudyVideos } from "@/lib/content/case-studies";
import { accelerator } from "@/lib/content/home";
import { testimonialsV2 } from "@/lib/content/home-v2";

const VISIBLE_QUOTES = 4;

export function TestimonialsV2() {
  return (
    <section
      id="success-stories"
      className="scroll-mt-24 bg-white px-5 py-24 lg:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="text-center">
          <p
            data-reveal
            className="text-sm font-black tracking-wide text-[#066a99] uppercase"
          >
            {testimonialsV2.eyebrow}
          </p>
          <h2
            data-reveal
            className="v2-display mt-3 text-[clamp(2.6rem,4.5vw,4.5rem)] leading-[1.0] text-[#111111] uppercase"
            style={{ "--v2-delay": "0.06s" } as CSSProperties}
          >
            {testimonialsV2.title}
          </h2>
          <p
            data-reveal
            className="mx-auto mt-5 max-w-xl text-lg leading-8 font-semibold text-slate-700"
            style={{ "--v2-delay": "0.12s" } as CSSProperties}
          >
            {testimonialsV2.body}
          </p>
        </div>

        <ul className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {caseStudyVideos.map((video, index) => (
            <li
              key={video.id}
              data-reveal="pop"
              style={
                { "--v2-delay": `${(index % 4) * 0.08}s` } as CSSProperties
              }
            >
              <VideoTestimonialCard video={video} />
            </li>
          ))}
        </ul>

        {/* Fourteen full reviews stacked into ~6,000px on a phone (UI audit,
            2026-09-22). The first few show; the rest sit one tap away. */}
        <ul className="mt-16 grid gap-6 lg:grid-cols-2">
          {caseStudyQuotes.slice(0, VISIBLE_QUOTES).map((quote, index) => (
            <li
              key={quote.id}
              data-reveal
              style={
                { "--v2-delay": `${(index % 2) * 0.08}s` } as CSSProperties
              }
            >
              <QuoteTestimonialCard quote={quote} />
            </li>
          ))}
        </ul>

        {caseStudyQuotes.length > VISIBLE_QUOTES ? (
          <details className="group mt-6">
            <summary className="rounded-control border-ink text-ink shadow-btn hover:shadow-btn-hover focus-visible:ring-sky mx-auto flex w-fit cursor-pointer list-none items-center gap-2 border-2 bg-white px-5 py-3 text-sm font-black uppercase transition group-open:hidden hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              Read {caseStudyQuotes.length - VISIBLE_QUOTES} more reviews
            </summary>
            <ul className="grid gap-6 lg:grid-cols-2">
              {caseStudyQuotes.slice(VISIBLE_QUOTES).map((quote) => (
                <li key={quote.id}>
                  <QuoteTestimonialCard quote={quote} />
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {/* The section now sits high on the page, so it has to offer the next
            step itself rather than relying on the final CTA band far below. */}
        <div className="mt-14 flex justify-center" data-reveal>
          <Button href={accelerator.cta.href} showArrow>
            {accelerator.cta.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
