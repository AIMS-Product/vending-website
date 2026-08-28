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

/**
 * Row 2: what they did before vending.
 *
 * Separate from the row-1 groups because it answers a different question —
 * row 1 is "what kind of story is this", this is "was this person me". A
 * visitor who was a cop, a nurse, or a sales rep looks for their own job
 * first and the business shape second.
 *
 * Same any-of-these-tags matching as row 1, so a story with several prior
 * careers (Anthony was corporate, sales AND real estate) shows under each.
 */
export const CAREER_TAG_GROUPS = [
  { id: "corporate", label: "Corporate", tags: ["from-corporate"] },
  { id: "sales", label: "Sales", tags: ["from-sales"] },
  { id: "trades", label: "Trades & Industrial", tags: ["from-trades"] },
  {
    id: "food-hospitality",
    label: "Food & Hospitality",
    tags: ["from-food-hospitality"],
  },
  { id: "finance", label: "Finance", tags: ["from-finance"] },
  { id: "real-estate", label: "Real Estate", tags: ["from-real-estate"] },
  { id: "tech", label: "Tech", tags: ["from-tech"] },
  { id: "fitness", label: "Fitness", tags: ["from-fitness"] },
  {
    id: "public-safety",
    label: "Police & Military",
    tags: ["from-public-safety"],
  },
  { id: "healthcare", label: "Healthcare", tags: ["from-healthcare"] },
] as const;

/**
 * Life-situation values. These are NOT filter chips on purpose: there are
 * eighteen of them, and a row that wide stops being a filter and starts being
 * a wall. They render as badges on the card and the article, where their job
 * is to make a person feel real rather than to narrow a list.
 *
 * Order is priority order. The card shows the first two a story matches, so
 * the most humanising fact wins the limited space — who they built it with
 * beats how they felt about their old job.
 *
 * Deliberately absent, though all three are evidenced in the bodies:
 * bereavement, special-needs children, and personal bankruptcy. Those belong
 * in a story someone chooses to read, not in a badge on a grid.
 */
export const HUMAN_BADGES = [
  { tag: "with-spouse", label: "Built it with their spouse" },
  { tag: "with-their-kids", label: "Built it with their kids" },
  { tag: "with-a-business-partner", label: "Built it with a business partner" },
  { tag: "stay-at-home-parent", label: "Stay-at-home parent" },
  { tag: "kept-the-day-job", label: "Kept the day job" },
  { tag: "quit-the-job", label: "Quit to go all in" },
  { tag: "between-jobs", label: "Between jobs" },
  { tag: "already-self-employed", label: "Already self-employed" },
  { tag: "new-parent", label: "Started on parental leave" },
  { tag: "recent-grad", label: "Just out of college" },
  { tag: "started-after-50", label: "Started in their 50s or 60s" },
  { tag: "raising-kids", label: "Raising kids while building" },
  { tag: "sole-breadwinner", label: "Sole breadwinner" },
  { tag: "burned-out", label: "Burned out on the grind" },
  { tag: "after-a-failed-business", label: "Came back from a failed business" },
  { tag: "money-was-tight", label: "Money was tight" },
  { tag: "layoff-or-ai-hedge", label: "Hedging against layoffs" },
  { tag: "after-a-big-move", label: "Started after a big move" },
  { tag: "built-solo", label: "Built it solo" },
] as const;

/** Badge labels a story earns, in priority order. `limit` caps a tight card. */
export function humanBadges(
  tags: readonly string[],
  limit: number = HUMAN_BADGES.length,
): string[] {
  return HUMAN_BADGES.filter((badge) => tags.includes(badge.tag))
    .slice(0, limit)
    .map((badge) => badge.label);
}

function matchesTagGroup(
  tags: readonly string[],
  groupId: string,
  groups: readonly {
    id: string;
    tags: readonly string[];
  }[] = CASE_STUDY_TAG_GROUPS,
): boolean {
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) return false;
  return group.tags.some((tag) => tags.includes(tag));
}

export type CaseStudyFilters = {
  tag: string | null;
  career: string | null;
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
  availableCareerIds: readonly string[] = [],
): CaseStudyFilters {
  const tag = firstParam(searchParams.tag);
  const career = firstParam(searchParams.career);
  const revenue = firstParam(searchParams.revenue);
  return {
    tag: tag && availableGroupIds.includes(tag) ? tag : null,
    career: career && availableCareerIds.includes(career) ? career : null,
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
      filters.career &&
      !matchesTagGroup(caseStudy.tags, filters.career, CAREER_TAG_GROUPS)
    ) {
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

/** One facet per prior-career group, in declaration order. Empty ones hidden. */
export function buildCareerFacets(
  caseStudies: readonly CaseStudyCard[],
): Facet[] {
  return CAREER_TAG_GROUPS.map((group) => ({
    value: group.id,
    label: group.label,
    count: caseStudies.filter((caseStudy) =>
      matchesTagGroup(caseStudy.tags, group.id, CAREER_TAG_GROUPS),
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
  if (next.career) params.set("career", next.career);
  if (next.revenue) params.set("revenue", next.revenue);
  const query = params.toString();
  return query ? `/case-studies?${query}` : "/case-studies";
}
