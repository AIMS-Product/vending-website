import { testimonials, type Testimonial } from "@/lib/content/testimonials";

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

        <ul className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <li key={t.id}>
              <TestimonialCard testimonial={t} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <article className="bg-brand-50/40 ring-brand-100/60 flex flex-col gap-4 rounded-3xl p-6 text-left shadow-sm ring-1">
      <VideoPlaceholder testimonial={testimonial} />
      <Stars />
      <header>
        <h3 className="text-brand-600 text-base font-semibold">
          {testimonial.name}
        </h3>
        <p className="text-sm text-slate-500">{testimonial.role}</p>
      </header>
    </article>
  );
}

function VideoPlaceholder({ testimonial }: { testimonial: Testimonial }) {
  // Slice 1b will swap this for the Cloudflare Stream <iframe>
  // when testimonial.videoId becomes non-null.
  return (
    <div
      aria-label={`Video testimonial from ${testimonial.name} — coming soon`}
      className="from-brand-200 via-brand-300 to-brand-400 relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br"
    >
      <span className="text-3xl font-semibold text-white drop-shadow">
        {testimonial.initials}
      </span>
    </div>
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
