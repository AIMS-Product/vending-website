import Image from "next/image";
import {
  caseStudyQuotes,
  caseStudySectionHeadings,
  type CaseStudyQuote,
} from "@/lib/content/case-studies";

export function CaseStudyQuotes() {
  return (
    <section className="bg-[#f5fbff] px-5 py-16 lg:px-10 lg:py-20">
      <h2 className="sr-only">{caseStudySectionHeadings.quotes}</h2>
      <ul className="mx-auto grid max-w-[1500px] gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {caseStudyQuotes.map((quote) => (
          <li key={quote.id} className="min-w-0">
            <QuoteCard quote={quote} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuoteCard({ quote }: { quote: CaseStudyQuote }) {
  return (
    <article className="flex h-full flex-col gap-5 rounded-[10px] border-2 border-[#111111] bg-white p-6 text-left shadow-[7px_7px_0_#55b8e8]">
      <header className="flex items-center gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-[#111111] bg-[#eaf8ff]">
          <Image
            src={quote.avatarUrl}
            alt={`${quote.name} headshot`}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-[#111111] uppercase">
            {quote.name}
          </h3>
          <p className="truncate text-sm font-semibold text-slate-600">
            {quote.role}
          </p>
        </div>
      </header>
      <Stars />
      <div className="space-y-3 text-sm leading-relaxed font-semibold text-slate-700">
        {quote.body.map((p) => (
          <p key={p}>{p}</p>
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
