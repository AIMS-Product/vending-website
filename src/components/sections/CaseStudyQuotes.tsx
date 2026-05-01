import Image from "next/image";
import {
  caseStudyQuotes,
  type CaseStudyQuote,
} from "@/lib/content/case-studies";

export function CaseStudyQuotes() {
  return (
    <section className="px-6 py-16 lg:px-10 lg:py-20">
      <ul className="mx-auto grid max-w-[1400px] gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {caseStudyQuotes.map((quote) => (
          <li key={quote.id}>
            <QuoteCard quote={quote} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuoteCard({ quote }: { quote: CaseStudyQuote }) {
  return (
    <article className="ring-brand-100/60 flex h-full flex-col gap-5 rounded-3xl bg-white p-6 text-left shadow-sm ring-1">
      <header className="flex items-center gap-4">
        <div className="bg-brand-50 relative size-14 shrink-0 overflow-hidden rounded-full">
          <Image
            src={quote.avatarUrl}
            alt={`${quote.name} headshot`}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-brand-600 truncate text-base font-semibold">
            {quote.name}
          </h3>
          <p className="truncate text-sm text-slate-500">{quote.role}</p>
        </div>
      </header>
      <Stars />
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">
        {quote.body.map((p, i) => (
          <p key={i}>{p}</p>
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
