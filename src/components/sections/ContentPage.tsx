import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type {
  ContentPage as ContentPageData,
  PageCta,
  PageRelated,
  PageTestimonial,
} from "@/lib/content/content-page";
import { ContentJourney } from "./ContentJourney";
import { CARD, EYEBROW, Media, SECTION, WRAP } from "./content-page-parts";

/**
 * The template behind `/solutions/<slug>` and `/process/<slug>`. Every section
 * is driven by the record; sections with no content (testimonials, related)
 * are skipped rather than rendered empty.
 *
 * The argument and the feature blocks are one section — `ContentJourney` —
 * because as two they stated the same three promises twice, once in shorthand
 * and once at length. Only that section is a client component; the rest of the
 * page stays on the server.
 */
export function ContentPage({ page }: { page: ContentPageData }) {
  return (
    <>
      <Hero page={page} />
      {page.testimonials.length > 0 && (
        <Proof testimonials={page.testimonials} />
      )}
      <ContentJourney
        thesis={page.thesis}
        steps={page.steps}
        features={page.features}
        stepsCta={page.stepsCta}
      />
      <Closing closing={page.closing} />
      {page.related.length > 0 && <Related related={page.related} />}
    </>
  );
}

function Hero({ page }: { page: ContentPageData }) {
  return (
    <section className="bg-white px-5 pt-10 pb-16 lg:px-10 lg:pt-14 lg:pb-20">
      <div className={WRAP}>
        {/* Breadcrumbs stay deliberately quiet. The eyebrow directly under
            them is the loud one — two ranked lines of small type competing at
            the same weight is what made this corner read as noise. */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <li>
              <Link href="/" className="hover:text-brand-700">
                Home
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link href={page.parent.href} className="hover:text-brand-700">
                {page.parent.label}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-slate-700">
              {page.breadcrumb}
            </li>
          </ol>
        </nav>

        <div
          className={
            page.hero
              ? "grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16"
              : ""
          }
        >
          <div className="min-w-0">
            {/* Accent blue on ink, never white text on blue: `--brand-600`
                only clears 3.56:1 against white. See DESIGN.md. */}
            <p className="bg-brand-200 inline-flex items-center rounded-full border-2 border-[#111111] px-3.5 py-1.5 text-xs font-black tracking-[0.14em] text-[#111111] uppercase shadow-[3px_3px_0_#111111]">
              {page.eyebrow}
            </p>
            {/* Without a visual beside it the headline carries the whole row,
                so it gets the wider measure and the larger step. */}
            <h1
              className={`mt-5 text-3xl leading-[1.08] font-black text-balance break-words text-[#111111] uppercase sm:text-4xl lg:text-5xl ${
                page.hero ? "" : "max-w-5xl lg:text-6xl"
              }`}
            >
              {page.title}
            </h1>
            <p
              className={`mt-5 text-lg leading-8 font-semibold text-slate-700 ${
                page.hero ? "max-w-xl" : "max-w-3xl"
              }`}
            >
              {page.intro}
            </p>
            <CtaRow ctas={page.ctas} className="mt-7" />
          </div>
          {page.hero && (
            <Media
              media={page.hero}
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Proof({
  testimonials,
}: {
  testimonials: ReadonlyArray<PageTestimonial>;
}) {
  return (
    <section className={`bg-[#f5fbff] px-5 py-16 lg:px-10 lg:py-20`}>
      <div className={WRAP}>
        <h2 className="max-w-3xl text-2xl leading-tight font-black text-[#111111] uppercase sm:text-3xl">
          Operators already running this
        </h2>
        <ul className="mt-8 grid gap-8 lg:grid-cols-3">
          {testimonials.map((item) => (
            <li
              key={item.name + item.topic}
              className={`${CARD} reveal-item p-7`}
            >
              <p className={EYEBROW}>{item.topic}</p>
              <blockquote className="mt-4 text-lg leading-7 font-semibold text-[#111111]">
                “{item.quote}”
              </blockquote>
              <div className="mt-6 flex items-center gap-4">
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full border-2 border-[#111111] bg-[#eaf8ff]">
                  {item.avatar && (
                    <Image
                      src={item.avatar}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div>
                  <div className="font-black text-[#111111]">{item.name}</div>
                  <div className="text-sm font-semibold text-slate-600">
                    {item.meta}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing({ closing }: { closing: ContentPageData["closing"] }) {
  return (
    <section className={`bg-white ${SECTION}`}>
      <div
        className={`${WRAP} ${CARD} px-6 py-14 text-center shadow-[10px_10px_0_#55b8e8] lg:px-16`}
      >
        <h2 className="mx-auto max-w-3xl text-3xl leading-tight font-black text-balance text-[#111111] uppercase sm:text-4xl">
          {closing.title}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
          {closing.body}
        </p>
        <CtaRow ctas={closing.ctas} className="mt-8 justify-center" />
      </div>
    </section>
  );
}

function Related({ related }: { related: ReadonlyArray<PageRelated> }) {
  return (
    <section className={`bg-[#f5fbff] ${SECTION}`}>
      <div className={WRAP}>
        <h2 className="max-w-4xl text-2xl leading-tight font-black text-balance text-[#111111] uppercase sm:text-3xl">
          Everything you need to start and scale your vending business
        </h2>
        <ul className="mt-10 grid gap-8 lg:grid-cols-3">
          {related.map((item) => (
            <li key={item.href} className="reveal-item">
              <Link
                href={item.href}
                className={`${CARD} ease-out-quart group block h-full p-7 shadow-[8px_8px_0_#111111] transition duration-300 hover:-translate-y-1 hover:shadow-[12px_12px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none`}
              >
                <h3 className="flex items-start justify-between gap-4 text-xl font-black text-[#111111] uppercase">
                  {item.title}
                  <span
                    aria-hidden
                    className="ease-out-quart text-brand-600 mt-0.5 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </h3>
                <p className="mt-3 font-semibold text-slate-700">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CtaRow({
  ctas,
  className,
}: {
  ctas: ReadonlyArray<PageCta>;
  className?: string;
}) {
  if (ctas.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-4 ${className ?? ""}`}>
      {ctas.map((cta) => (
        <Button
          key={cta.href + cta.label}
          href={cta.href}
          variant={cta.variant ?? "primary"}
        >
          {cta.label}
        </Button>
      ))}
    </div>
  );
}
