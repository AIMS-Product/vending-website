import type { CSSProperties } from "react";
import {
  QuoteTestimonialCard,
  VideoTestimonialCard,
} from "@/components/sections/Testimonials";
import { caseStudyQuotes, caseStudyVideos } from "@/lib/content/case-studies";
import { testimonialsV2 } from "@/lib/content/home-v2";
import { cn } from "@/lib/utils";

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
              {/* Offset alternating columns for a collage rhythm; lives on an
                  inner div so the reveal transform can't overwrite it. */}
              <div
                className={cn(
                  "h-full transition hover:-translate-y-1",
                  index % 2 === 1 && "lg:translate-y-6 lg:hover:translate-y-5",
                )}
              >
                <VideoTestimonialCard video={video} />
              </div>
            </li>
          ))}
        </ul>

        <ul className="mt-16 grid gap-6 lg:grid-cols-2">
          {caseStudyQuotes.map((quote, index) => (
            <li
              key={quote.id}
              data-reveal
              style={
                { "--v2-delay": `${(index % 2) * 0.08}s` } as CSSProperties
              }
            >
              <div
                className={cn(
                  "h-full transition duration-300 hover:rotate-0",
                  index % 2 === 1
                    ? "lg:rotate-[0.75deg]"
                    : "lg:rotate-[-0.75deg]",
                )}
              >
                <QuoteTestimonialCard quote={quote} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
