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
 * Row 2: who the member was.
 *
 * One row, not the three it started as. "Their situation", "Who they are" and
 * "What they did before" were measurably the same axis: Blue Collar and
 * Trades & Industrial matched an identical set of stories (Jaccard 1.00), as
 * did Military & Law Enforcement and Police & Military; Leaving a W-2 and
 * Corporate shared 8 of 11. Rendering those as separate chips asked a visitor
 * to choose between two words for one idea.
 *
 * So each entry here collects every tag that means the same thing, whatever
 * vocabulary it arrived in — the Objection Library's ICP names, our own
 * `from-*` career tags, and the older situation tags. A story matches if it
 * carries any one of them.
 *
 * Deliberately dropped rather than merged: `scaling` (19 of 25 stories),
 * `career-change` (15), `part-time` (11) and `first-location`/`no-experience`
 * (11). A chip that keeps three quarters of the set does not narrow anything,
 * and these were the four widest on the page.
 *
 * Declaration order is display order, roughly most-common first.
 */
export const WHO_TAG_GROUPS = [
  {
    id: "leaving-w2",
    label: "Leaving a W-2",
    tags: ["icp-leaving-w2", "from-corporate"],
  },
  { id: "entrepreneur", label: "Entrepreneur", tags: ["icp-entrepreneur"] },
  {
    id: "family-business",
    label: "Family business",
    tags: ["icp-family-biz", "family-business", "couple"],
  },
  { id: "women", label: "Women in vending", tags: ["icp-female"] },
  {
    id: "blue-collar",
    label: "Blue collar & trades",
    tags: ["icp-blue-collar", "from-trades"],
  },
  {
    id: "military",
    label: "Military & law enforcement",
    tags: ["icp-military", "from-public-safety"],
  },
  {
    id: "serial-entrepreneur",
    label: "Serial entrepreneur",
    tags: ["icp-serial-entrepreneur"],
  },
  { id: "investor", label: "Investor", tags: ["icp-investor"] },
  { id: "laid-off", label: "Laid off", tags: ["icp-laid-off", "laid-off"] },
  {
    id: "stay-at-home-parent",
    label: "Stay-at-home parent",
    tags: ["icp-stay-at-home-parent", "stay-at-home-parent"],
  },
  {
    id: "young-professional",
    label: "Just starting out",
    tags: ["icp-young-professional", "recent-grad"],
  },
  { id: "retired", label: "Retired", tags: ["icp-retired", "retiree"] },
] as const;

export type WhoTagGroupId = (typeof WHO_TAG_GROUPS)[number]["id"];

/**
 * The specific job someone left. Lives behind "More filters" rather than in a
 * visible row: it is the long tail of row 2, useful to the visitor who wants
 * to see a nurse or a firefighter specifically, irrelevant to everyone else.
 *
 * Corporate, Trades and Police & Military are absent on purpose — they are
 * merged into `WHO_TAG_GROUPS` above, where they were duplicating an ICP chip.
 */
export const CAREER_TAG_GROUPS = [
  { id: "sales", label: "Sales", tags: ["from-sales"] },
  { id: "real-estate", label: "Real estate", tags: ["from-real-estate"] },
  { id: "finance", label: "Finance", tags: ["from-finance"] },
  {
    id: "food-hospitality",
    label: "Food & hospitality",
    tags: ["from-food-hospitality"],
  },
  { id: "tech", label: "Tech", tags: ["from-tech"] },
  { id: "fitness", label: "Fitness", tags: ["from-fitness"] },
  { id: "healthcare", label: "Healthcare", tags: ["from-healthcare"] },
] as const;

/**
 * Row 3: the objection a story defuses.
 *
 * These are not derived here — they are inherited from the Objection Library
 * (objection-library.vercel.app), where the sales team hand-tagged every
 * member video with the objections it answers. `scripts/merge-objection-
 * library-tags.mjs` joins the two collections on YouTube id and writes these
 * tags onto the story. Keep the labels identical to the library's, or the two
 * tools drift into two vocabularies for one idea.
 *
 * This is the only row phrased as the visitor's question rather than the
 * member's attribute: a prospect arrives with a specific reason they have not
 * bought, and this is the row that maps that reason onto a person who had it.
 *
 * "Contract / Legal" exists in the library but currently matches no story, so
 * it is absent here rather than rendering a chip that returns nothing. Add it
 * back the moment a story earns it.
 */
export const OBJECTION_TAG_GROUPS = [
  { id: "price", label: "Can I afford it?", tags: ["objection-price"] },
  { id: "roi", label: "Does it actually pay?", tags: ["objection-roi"] },
  { id: "timing", label: "Do I have the time?", tags: ["objection-timing"] },
  {
    id: "need-fit",
    label: "Could someone like me do it?",
    tags: ["objection-need-fit"],
  },
  {
    id: "spouse",
    label: "Getting my partner on board",
    tags: ["objection-spouse"],
  },
  {
    id: "status-quo",
    label: "Leaving a stable job",
    tags: ["objection-status-quo"],
  },
  {
    id: "implementation",
    label: "Can I actually run it?",
    tags: ["objection-implementation"],
  },
  { id: "trust", label: "Is this legit?", tags: ["objection-trust"] },
  { id: "diy", label: "Why not do it alone?", tags: ["objection-diy"] },
] as const;

export type ObjectionTagGroupId = (typeof OBJECTION_TAG_GROUPS)[number]["id"];

/**
 * Row 3: where the machines are.
 *
 * `location_types` is free text typed per story, so it arrived with 23 values
 * for about 14 real places — "apartment"/"apartments", "gym"/"fitness center",
 * "government facility"/"government-building". Normalising on read rather than
 * rewriting the stored values keeps the members' own wording intact on the
 * article page, where it reads as a person describing their route, while the
 * filter still collapses to one chip per place.
 *
 * Matching is on the whole normalised value, never a substring: "office"
 * must not swallow "dental office", which is a different kind of account.
 */
export const LOCATION_GROUPS = [
  {
    id: "apartments",
    label: "Apartments",
    values: ["apartment", "apartments", "condo", "residential"],
  },
  {
    id: "offices",
    label: "Offices",
    values: ["office", "corporate office"],
  },
  {
    id: "schools",
    label: "Schools & campuses",
    values: ["school", "college", "student housing"],
  },
  {
    id: "gyms",
    label: "Gyms",
    values: ["gym", "fitness center"],
  },
  {
    id: "industrial",
    label: "Industrial & warehouse",
    values: [
      "industrial",
      "manufacturing",
      "warehouse",
      "union training center",
    ],
  },
  {
    id: "government",
    label: "Government & civic",
    values: ["government facility", "government-building", "courthouse"],
  },
  {
    id: "medical",
    label: "Medical",
    values: ["dental office", "medical response facility"],
  },
  {
    id: "hospitality",
    label: "Hotels",
    values: ["hotel"],
  },
  {
    id: "senior-living",
    label: "Senior living",
    values: ["retirement-community"],
  },
  {
    id: "micro-market",
    label: "Micro markets",
    values: ["micro-market"],
  },
] as const;

export type LocationGroupId = (typeof LOCATION_GROUPS)[number]["id"];

/** Lowercase and collapse whitespace/hyphens so "Micro Market" meets "micro-market". */
function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

const LOCATION_LOOKUP = new Map<string, string>(
  LOCATION_GROUPS.flatMap((group) =>
    group.values.map((value) => [normalizeLocation(value), group.id] as const),
  ),
);

export function matchesLocationGroup(
  locationTypes: readonly string[],
  groupId: string,
): boolean {
  return locationTypes.some(
    (value) => LOCATION_LOOKUP.get(normalizeLocation(value)) === groupId,
  );
}

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
  }[],
): boolean {
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) return false;
  return group.tags.some((tag) => tags.includes(tag));
}

export type CaseStudyFilters = {
  objection: string | null;
  who: string | null;
  career: string | null;
  location: string | null;
  revenue: RevenueBandId | null;
};

/** The tag-backed axes, in the order they render. Location and revenue are
 * not here: they read `location_types` and `monthly_revenue_usd`, not `tags`. */
export const TAG_AXES = {
  objection: OBJECTION_TAG_GROUPS,
  who: WHO_TAG_GROUPS,
  career: CAREER_TAG_GROUPS,
} as const;

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
  available: Partial<Record<keyof CaseStudyFilters, readonly string[]>>,
): CaseStudyFilters {
  const pick = (axis: keyof CaseStudyFilters): string | null => {
    const raw = firstParam(searchParams[axis]);
    return raw && (available[axis] ?? []).includes(raw) ? raw : null;
  };
  const revenue = firstParam(searchParams.revenue);
  return {
    objection: pick("objection"),
    who: pick("who"),
    career: pick("career"),
    location: pick("location"),
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
    for (const [axis, groups] of Object.entries(TAG_AXES)) {
      const selected = filters[axis as keyof typeof TAG_AXES];
      if (selected && !matchesTagGroup(caseStudy.tags, selected, groups)) {
        return false;
      }
    }
    if (
      filters.location &&
      !matchesLocationGroup(caseStudy.location_types, filters.location)
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

/**
 * One facet per group, in declaration order. Empty groups are hidden, so a
 * vocabulary can carry a value no story has earned yet without rendering a
 * chip that leads to an empty page.
 */
export function buildTagFacets(
  caseStudies: readonly CaseStudyCard[],
  groups: readonly { id: string; label: string; tags: readonly string[] }[],
): Facet[] {
  return groups
    .map((group) => ({
      value: group.id,
      label: group.label,
      count: caseStudies.filter((caseStudy) =>
        matchesTagGroup(caseStudy.tags, group.id, groups),
      ).length,
    }))
    .filter((facet) => facet.count > 0);
}

/** One facet per location family. Reads `location_types`, not `tags`. */
export function buildLocationFacets(
  caseStudies: readonly CaseStudyCard[],
): Facet[] {
  return LOCATION_GROUPS.map((group) => ({
    value: group.id,
    label: group.label,
    count: caseStudies.filter((caseStudy) =>
      matchesLocationGroup(caseStudy.location_types, group.id),
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
  for (const [axis, value] of Object.entries(next)) {
    if (value) params.set(axis, value);
  }
  const query = params.toString();
  return query ? `/case-studies?${query}` : "/case-studies";
}
