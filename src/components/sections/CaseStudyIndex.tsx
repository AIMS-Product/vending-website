import Link from "next/link";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import type { CaseStudyCard as CaseStudyCardData } from "@/lib/services/case-studies";
import {
  caseStudySectionHeadings,
  caseStudySectionIntro,
} from "@/lib/content/case-studies";
import {
  caseStudiesHref,
  type CaseStudyFilters,
  type Facet,
} from "@/lib/case-studies/index-filters";

type CaseStudyIndexProps = {
  caseStudies: readonly CaseStudyCardData[];
  filters: CaseStudyFilters;
  tagFacets: readonly Facet[];
  careerFacets: readonly Facet[];
  totalCount: number;
};

/**
 * Filtering is plain links over `searchParams`, not client state. Every filtered
 * view is a real, shareable, crawlable URL, and the page ships no JavaScript
 * for it.
 */
export function CaseStudyIndex({
  caseStudies,
  filters,
  tagFacets,
  careerFacets,
  totalCount,
}: CaseStudyIndexProps) {
  const isFiltered = Boolean(filters.tag || filters.career || filters.revenue);

  return (
    <section className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-16 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-[1500px]">
        <h2 className="text-[clamp(1.75rem,2.6vw,2.5rem)] leading-[1.05] font-black text-[#111111] uppercase">
          {caseStudySectionHeadings.stories}
        </h2>
        <p className="mt-4 mb-8 max-w-[720px] text-base leading-relaxed font-semibold text-slate-600">
          {caseStudySectionIntro}
        </p>

        <div className="space-y-6">
          {tagFacets.length > 0 && (
            <FacetRow
              label="Filter stories by situation"
              legend="Their situation"
              facets={tagFacets}
              activeValue={filters.tag}
              hrefFor={(value) =>
                caseStudiesHref(filters, {
                  tag: value === filters.tag ? null : value,
                })
              }
            />
          )}

          {/*
          A second row rather than more chips in the first: "what kind of story
          is this" and "what did this person do before" are different questions,
          and a visitor looking for their own old job should not have to read
          past six business-shape chips to find it.
        */}
          {careerFacets.length > 0 && (
            <FacetRow
              label="Filter stories by what they did before vending"
              legend="What they did before"
              facets={careerFacets}
              activeValue={filters.career}
              hrefFor={(value) =>
                caseStudiesHref(filters, {
                  career: value === filters.career ? null : value,
                })
              }
            />
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p
            className="text-sm font-black tracking-[0.12em] text-[#066a99] uppercase"
            aria-live="polite"
          >
            {caseStudies.length} of {totalCount}{" "}
            {totalCount === 1 ? "story" : "stories"}
          </p>
          {isFiltered && (
            <Link
              href="/case-studies"
              className="text-sm font-black text-[#111111] underline decoration-2 underline-offset-4 transition hover:text-[#066a99]"
            >
              Clear filters
            </Link>
          )}
        </div>

        {caseStudies.length === 0 ? (
          <p className="mt-10 rounded-[10px] border-2 border-[#111111] bg-white p-8 text-lg font-semibold text-slate-700 shadow-[7px_7px_0_#55b8e8]">
            No stories match that combination yet.{" "}
            <Link
              href="/case-studies"
              className="font-black text-[#066a99] underline decoration-2 underline-offset-4"
            >
              Show every story
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {caseStudies.map((caseStudy) => (
              <li key={caseStudy.slug} className="min-w-0">
                <CaseStudyCard caseStudy={caseStudy} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FacetRow({
  label,
  legend,
  facets,
  activeValue,
  hrefFor,
}: {
  label: string;
  legend: string;
  facets: readonly Facet[];
  activeValue: string | null;
  hrefFor: (value: string) => string;
}) {
  return (
    // Two rows now, so each carries a visible legend as well as the accessible
    // name — with one row the chips were self-describing, with two they are
    // only self-describing if you already know the axes.
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <span className="w-full text-xs font-black tracking-[0.12em] text-slate-500 uppercase">
        {legend}
      </span>
      {facets.map((facet) => {
        const isActive = facet.value === activeValue;
        return (
          <Link
            key={facet.value}
            href={hrefFor(facet.value)}
            scroll={false}
            // A link cannot be "pressed"; aria-current is the correct role for
            // "this filter is the one in effect".
            aria-current={isActive ? "true" : undefined}
            className={[
              "inline-flex items-center gap-2 rounded-[8px] border-2 border-[#111111] px-4 py-2 text-xs font-black uppercase transition hover:-translate-y-0.5",
              isActive
                ? "bg-[#111111] text-white shadow-[4px_4px_0_#55b8e8]"
                : "bg-white text-[#111111] shadow-[4px_4px_0_#111111] hover:bg-[#eaf8ff]",
            ].join(" ")}
          >
            {facet.label}
            <span
              className={
                isActive
                  ? "text-[#55b8e8] tabular-nums"
                  : "text-slate-500 tabular-nums"
              }
            >
              {facet.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
