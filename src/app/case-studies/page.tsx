import type { Metadata } from "next";
import { CaseStudiesHero } from "@/components/sections/CaseStudiesHero";
import { CaseStudyIndex } from "@/components/sections/CaseStudyIndex";
import { FeaturedCaseStudy } from "@/components/sections/FeaturedCaseStudy";
import { CaseStudyQuotes } from "@/components/sections/CaseStudyQuotes";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  getFeaturedCaseStudy,
  listPublishedCaseStudies,
} from "@/lib/services/case-studies";
import {
  applyCaseStudyFilters,
  buildLocationFacets,
  buildRevenueFacets,
  buildTagFacets,
  parseCaseStudyFilters,
  TAG_AXES,
  type Facet,
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
  const [caseStudies, featured] = await Promise.all([
    listPublishedCaseStudies({ limit: 100 }),
    getFeaturedCaseStudy(),
  ]);

  // Facets are built from the unfiltered set so the counts stay stable as the
  // visitor clicks, rather than collapsing to the current selection.
  const facets: Record<string, Facet[]> = {
    objection: buildTagFacets(caseStudies, TAG_AXES.objection),
    who: buildTagFacets(caseStudies, TAG_AXES.who),
    career: buildTagFacets(caseStudies, TAG_AXES.career),
    revenue: buildRevenueFacets(caseStudies),
    location: buildLocationFacets(caseStudies),
  };

  const filters = parseCaseStudyFilters(
    params,
    Object.fromEntries(
      Object.entries(facets).map(([axis, list]) => [
        axis,
        list.map((facet) => facet.value),
      ]),
    ),
  );
  const visible = applyCaseStudyFilters(caseStudies, filters);

  return (
    <>
      <CaseStudiesHero />
      {featured ? <FeaturedCaseStudy caseStudy={featured} /> : null}
      <CaseStudyIndex
        caseStudies={visible}
        filters={filters}
        facets={facets}
        totalCount={caseStudies.length}
      />
      <CaseStudyQuotes />
      <FinalCta />
    </>
  );
}
