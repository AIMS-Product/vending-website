import {
  caseStudyQuotes,
  caseStudyVideos,
  type CaseStudyQuote,
  type CaseStudyVideo,
} from "@/lib/content/case-studies";

export function Testimonials() {
  return (
    <section className="bg-white px-5 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-[1500px] text-center">
        <p className="text-sm font-black text-[#066a99] uppercase">
          Success Stories
        </p>
        <h2 className="mt-4 text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
          Real People, Real Results
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 font-semibold text-slate-700">
          See how others have built profitable vending businesses with our
          coaching.
        </p>

        <ul className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {caseStudyVideos.map((video) => (
            <li key={video.id}>
              <VideoTestimonialCard video={video} />
            </li>
          ))}
        </ul>

        <ul className="mt-12 grid gap-6 text-left lg:grid-cols-2">
          {caseStudyQuotes.map((quote) => (
            <li key={quote.id}>
              <QuoteTestimonialCard quote={quote} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function VideoTestimonialCard({ video }: { video: CaseStudyVideo }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-[10px] border-2 border-[#111111] bg-white p-5 text-left shadow-[7px_7px_0_#55b8e8]">
      <video
        controls
        preload="none"
        poster={video.posterUrl}
        className="aspect-video w-full rounded-[8px] border-2 border-[#111111] bg-slate-100 object-contain"
        aria-label={`Video testimonial from ${video.name}`}
      >
        <source src={video.videoUrl} type="video/mp4" />
      </video>
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
    <article className="flex h-full flex-col gap-4 rounded-[10px] border-2 border-[#111111] bg-white p-6 text-left shadow-[7px_7px_0_#55b8e8]">
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
    <div className="flex gap-0.5 text-[#f47b3b]">
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
