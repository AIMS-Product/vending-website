import Link from "next/link";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import type { CaseStudyCard as CaseStudyCardData } from "@/lib/services/case-studies";
import { caseStudySectionHeadings } from "@/lib/content/case-studies";
import {
  caseStudiesHref,
  type CaseStudyFilters,
  type Facet,
} from "@/lib/case-studies/index-filters";

type CaseStudyIndexProps = {
  caseStudies: readonly CaseStudyCardData[];
  filters: CaseStudyFilters;
  tagFacets: readonly Facet[];
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
  totalCount,
}: CaseStudyIndexProps) {
  const isFiltered = Boolean(filters.tag || filters.revenue);

  return (
    <section className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-16 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-[1500px]">
        <h2 className="sr-only">{caseStudySectionHeadings.stories}</h2>

        {tagFacets.length > 0 && (
          <FacetRow
            facets={tagFacets}
            activeValue={filters.tag}
            hrefFor={(value) =>
              caseStudiesHref(filters, {
                tag: value === filters.tag ? null : value,
              })
            }
          />
        )}

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
  facets,
  activeValue,
  hrefFor,
}: {
  facets: readonly Facet[];
  activeValue: string | null;
  hrefFor: (value: string) => string;
}) {
  return (
    // Labelled nav rather than a visible legend: one row of self-describing
    // chips needs no heading, but assistive tech still needs the grouping.
    <nav
      aria-label="Filter stories"
      className="flex flex-wrap items-center gap-3"
    >
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
