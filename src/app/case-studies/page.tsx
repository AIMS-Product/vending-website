import type { Metadata } from "next";
import { CaseStudiesHero } from "@/components/sections/CaseStudiesHero";
import { CaseStudyIndex } from "@/components/sections/CaseStudyIndex";
import { CaseStudyQuotes } from "@/components/sections/CaseStudyQuotes";
import { FinalCta } from "@/components/sections/FinalCta";
import { listPublishedCaseStudies } from "@/lib/services/case-studies";
import {
  applyCaseStudyFilters,
  buildRevenueFacets,
  buildTagFacets,
  parseCaseStudyFilters,
} from "@/lib/case-studies/index-filters";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Vendingpreneurs members share how they went from zero vending experience to a working route — video stories and written testimonials in their own words.",
  alternates: { canonical: "/case-studies" },
};

export default async function CaseStudiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const caseStudies = await listPublishedCaseStudies({ limit: 100 });

  // Facets are built from the unfiltered set so the counts stay stable as the
  // visitor clicks, rather than collapsing to the current selection.
  const tagFacets = buildTagFacets(caseStudies);
  const revenueFacets = buildRevenueFacets(caseStudies);
  const filters = parseCaseStudyFilters(
    params,
    tagFacets.map((facet) => facet.value),
  );
  const visible = applyCaseStudyFilters(caseStudies, filters);

  return (
    <>
      <CaseStudiesHero />
      <CaseStudyIndex
        caseStudies={visible}
        filters={filters}
        tagFacets={tagFacets}
        revenueFacets={revenueFacets}
        totalCount={caseStudies.length}
      />
      <CaseStudyQuotes />
      <FinalCta />
    </>
  );
}
