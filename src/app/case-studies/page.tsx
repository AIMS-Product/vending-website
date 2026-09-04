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
  buildCareerFacets,
  buildIcpFacets,
  buildLocationFacets,
  buildObjectionFacets,
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
  const [caseStudies, featured] = await Promise.all([
    listPublishedCaseStudies({ limit: 100 }),
    getFeaturedCaseStudy(),
  ]);

  // Facets are built from the unfiltered set so the counts stay stable as the
  // visitor clicks, rather than collapsing to the current selection.
  const tagFacets = buildTagFacets(caseStudies);
  const careerFacets = buildCareerFacets(caseStudies);
  const objectionFacets = buildObjectionFacets(caseStudies);
  const icpFacets = buildIcpFacets(caseStudies);
  const locationFacets = buildLocationFacets(caseStudies);
  const revenueFacets = buildRevenueFacets(caseStudies);
  const ids = (facets: readonly { value: string }[]) =>
    facets.map((facet) => facet.value);
  const filters = parseCaseStudyFilters(
    params,
    ids(tagFacets),
    ids(careerFacets),
    ids(objectionFacets),
    ids(icpFacets),
    ids(locationFacets),
  );
  const visible = applyCaseStudyFilters(caseStudies, filters);

  return (
    <>
      <CaseStudiesHero />
      {featured ? <FeaturedCaseStudy caseStudy={featured} /> : null}
      <CaseStudyIndex
        caseStudies={visible}
        filters={filters}
        tagFacets={tagFacets}
        careerFacets={careerFacets}
        objectionFacets={objectionFacets}
        icpFacets={icpFacets}
        locationFacets={locationFacets}
        revenueFacets={revenueFacets}
        totalCount={caseStudies.length}
      />
      <CaseStudyQuotes />
      <FinalCta />
    </>
  );
}
