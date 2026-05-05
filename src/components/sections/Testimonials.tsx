import {
  caseStudyQuotes,
  caseStudyVideos,
  type CaseStudyQuote,
  type CaseStudyVideo,
} from "@/lib/content/case-studies";

export function Testimonials() {
  return (
    <section className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-[1400px] text-center">
        <p className="text-brand-400 text-sm font-medium tracking-wide uppercase">
          Success Stories
        </p>
        <h2 className="text-brand-500 mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Real People, Real Results
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-slate-600">
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

function VideoTestimonialCard({ video }: { video: CaseStudyVideo }) {
  return (
    <article className="bg-brand-50/40 ring-brand-100/60 flex h-full flex-col gap-4 rounded-3xl p-5 text-left shadow-sm ring-1">
      <video
        controls
        preload="none"
        poster={video.posterUrl}
        className="aspect-[3/4] w-full rounded-2xl bg-slate-100 object-cover"
        aria-label={`Video testimonial from ${video.name}`}
      >
        <source src={video.videoUrl} type="video/mp4" />
      </video>
      <header>
        <h3 className="text-brand-600 text-base font-semibold">{video.name}</h3>
        <p className="text-sm text-slate-500">{video.role}</p>
      </header>
    </article>
  );
}

function QuoteTestimonialCard({ quote }: { quote: CaseStudyQuote }) {
  return (
    <article className="ring-brand-100/60 flex h-full flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1">
      <header>
        <h3 className="text-brand-600 text-base font-semibold">{quote.name}</h3>
        <p className="text-sm text-slate-500">{quote.role}</p>
      </header>
      <Stars />
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">
        {quote.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

function Stars() {
  return (
    <div
      aria-label="5 out of 5 stars"
      role="img"
      className="text-brand-400 flex gap-0.5"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
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
