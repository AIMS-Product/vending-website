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
  availableTags: readonly string[],
): CaseStudyFilters {
  const tag = firstParam(searchParams.tag);
  const revenue = firstParam(searchParams.revenue);
  return {
    tag: tag && availableTags.includes(tag) ? tag : null,
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
    if (filters.tag && !caseStudy.tags.includes(filters.tag)) return false;
    if (
      filters.revenue &&
      !matchesRevenueBand(caseStudy.monthly_revenue_usd, filters.revenue)
    ) {
      return false;
    }
    return true;
  });
}

/** Tag facets, most common first, then alphabetical so the order is stable. */
export function buildTagFacets(caseStudies: readonly CaseStudyCard[]): Facet[] {
  const counts = new Map<string, number>();
  for (const caseStudy of caseStudies) {
    for (const tag of caseStudy.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: humanizeTag(value), count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
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

/** `route-acquisition` -> `Route acquisition`. */
export function humanizeTag(tag: string): string {
  const spaced = tag.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
