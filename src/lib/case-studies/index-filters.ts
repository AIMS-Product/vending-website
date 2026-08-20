import type { CaseStudyCard } from "@/lib/services/case-studies";

/**
 * Revenue bands for the index filter.
 *
 * Bands rather than a slider because `monthly_revenue_usd` is null for members
 * who only ever stated an annual figure, and a slider silently hides those.
 * A band is also a stable, linkable URL, which a slider is not.
 *
 * `min` is inclusive, `max` exclusive.
 */
export const REVENUE_BANDS = [
  { id: "under-10k", label: "Under $10K/mo", min: 0, max: 10_000 },
  { id: "10k-25k", label: "$10K–$25K/mo", min: 10_000, max: 25_000 },
  { id: "25k-50k", label: "$25K–$50K/mo", min: 25_000, max: 50_000 },
  {
    id: "50k-plus",
    label: "$50K+/mo",
    min: 50_000,
    max: Number.POSITIVE_INFINITY,
  },
] as const;

export type RevenueBandId = (typeof REVENUE_BANDS)[number]["id"];

/**
 * The visible filter chips. Kody asked for one row, so the raw per-story tags
 * are rolled up into six groups here rather than being rewritten on the rows —
 * the underlying tags stay intact and available for future regrouping.
 *
 * Declaration order is the display order (Kody's, deliberate), not count order.
 * A story matches a group if it carries any one of the group's tags, so the
 * counts sum past the story total. That is expected: stories carry several tags.
 */
export const CASE_STUDY_TAG_GROUPS = [
  {
    id: "career-change",
    label: "Career Change",
    tags: ["career-change", "laid-off", "retiree"],
  },
  {
    id: "family-couple",
    label: "Family/Couple",
    tags: ["family-business", "couple"],
  },
  {
    id: "new-to-vending",
    label: "New to Vending",
    tags: ["first-location", "route-acquisition", "no-experience"],
  },
  { id: "part-time", label: "Part Time", tags: ["part-time"] },
  { id: "full-time", label: "Full Time", tags: ["full-time"] },
  { id: "scaling", label: "Scaling", tags: ["scaling"] },
] as const;

export type CaseStudyTagGroupId = (typeof CASE_STUDY_TAG_GROUPS)[number]["id"];

function matchesTagGroup(tags: readonly string[], groupId: string): boolean {
  const group = CASE_STUDY_TAG_GROUPS.find((entry) => entry.id === groupId);
  if (!group) return false;
  return group.tags.some((tag) => tags.includes(tag));
}

export type CaseStudyFilters = {
  tag: string | null;
  revenue: RevenueBandId | null;
};

export type Facet = { value: string; label: string; count: number };

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Unknown values resolve to `null` rather than an empty result set — a stale
 * or hand-edited URL should show everything, not an empty page that reads as
 * "we have no case studies".
 */
export function parseCaseStudyFilters(
  searchParams: Record<string, string | string[] | undefined>,
  availableGroupIds: readonly string[],
): CaseStudyFilters {
  const tag = firstParam(searchParams.tag);
  const revenue = firstParam(searchParams.revenue);
  return {
    tag: tag && availableGroupIds.includes(tag) ? tag : null,
    revenue: REVENUE_BANDS.some((band) => band.id === revenue)
      ? (revenue as RevenueBandId)
      : null,
  };
}

export function matchesRevenueBand(
  monthlyRevenueUsd: number | null,
  bandId: RevenueBandId,
): boolean {
  // No stated monthly figure cannot be placed in a band. Excluding it is
  // correct: including it would make "$50K+" show members who never claimed it.
  if (monthlyRevenueUsd === null) return false;
  const band = REVENUE_BANDS.find((entry) => entry.id === bandId);
  if (!band) return false;
  return monthlyRevenueUsd >= band.min && monthlyRevenueUsd < band.max;
}

export function applyCaseStudyFilters(
  caseStudies: readonly CaseStudyCard[],
  filters: CaseStudyFilters,
): CaseStudyCard[] {
  return caseStudies.filter((caseStudy) => {
    if (filters.tag && !matchesTagGroup(caseStudy.tags, filters.tag)) {
      return false;
    }
    if (
      filters.revenue &&
      !matchesRevenueBand(caseStudy.monthly_revenue_usd, filters.revenue)
    ) {
      return false;
    }
    return true;
  });
}

/** One facet per group, in declaration order. Empty groups are hidden. */
export function buildTagFacets(caseStudies: readonly CaseStudyCard[]): Facet[] {
  return CASE_STUDY_TAG_GROUPS.map((group) => ({
    value: group.id,
    label: group.label,
    count: caseStudies.filter((caseStudy) =>
      matchesTagGroup(caseStudy.tags, group.id),
    ).length,
  })).filter((facet) => facet.count > 0);
}

export function buildRevenueFacets(
  caseStudies: readonly CaseStudyCard[],
): Facet[] {
  return REVENUE_BANDS.map((band) => ({
    value: band.id,
    label: band.label,
    count: caseStudies.filter((caseStudy) =>
      matchesRevenueBand(caseStudy.monthly_revenue_usd, band.id),
    ).length,
  })).filter((facet) => facet.count > 0);
}

/**
 * Builds an index URL with one facet toggled. Selecting the active value
 * clears it, so every chip is its own on/off switch.
 */
export function caseStudiesHref(
  filters: CaseStudyFilters,
  change: Partial<CaseStudyFilters>,
): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.tag) params.set("tag", next.tag);
  if (next.revenue) params.set("revenue", next.revenue);
  const query = params.toString();
  return query ? `/case-studies?${query}` : "/case-studies";
}
