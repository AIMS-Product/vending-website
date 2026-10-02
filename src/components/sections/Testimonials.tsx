import { VideoCard } from "@/components/ui/VideoCard";
import type {
  CaseStudyQuote,
  CaseStudyVideo,
} from "@/lib/content/case-studies";

export function VideoTestimonialCard({ video }: { video: CaseStudyVideo }) {
  return (
    <article className="rounded-card border-ink shadow-card flex h-full flex-col gap-4 border-2 bg-white p-5 text-left">
      <VideoCard
        src={video.videoUrl}
        poster={video.posterUrl}
        label={`Video testimonial from ${video.name}`}
      />
      <header>
        <h3 className="text-base font-black text-[#111111] uppercase">
          {video.name}
        </h3>
        <p className="text-sm font-semibold text-slate-600">{video.role}</p>
      </header>
    </article>
  );
}

export function QuoteTestimonialCard({ quote }: { quote: CaseStudyQuote }) {
  return (
    <article className="rounded-card border-ink shadow-card flex h-full flex-col gap-4 border-2 bg-white p-6 text-left">
      <header>
        <h3 className="text-base font-black text-[#111111] uppercase">
          {quote.name}
        </h3>
        <p className="text-sm font-semibold text-slate-600">{quote.role}</p>
      </header>
      <Stars />
      <div className="space-y-3 text-sm leading-relaxed font-semibold text-slate-700">
        {quote.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

function Stars() {
  return (
    <div className="flex gap-0.5 text-[#2a8fcc]">
      <span className="sr-only">5 out of 5 stars</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-4"
          aria-hidden
        >
          <path d="M10 1.5l2.7 5.5 6 0.9-4.3 4.3 1 6-5.4-2.9-5.4 2.9 1-6L1.3 7.9l6-0.9z" />
        </svg>
      ))}
    </div>
  );
}
