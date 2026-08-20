import { describe, expect, it } from "vitest";
import {
  applyCaseStudyFilters,
  CASE_STUDY_TAG_GROUPS,
  buildRevenueFacets,
  buildTagFacets,
  caseStudiesHref,
  matchesRevenueBand,
  parseCaseStudyFilters,
} from "./index-filters";
import type { CaseStudyCard } from "@/lib/services/case-studies";

function card(overrides: Partial<CaseStudyCard> = {}): CaseStudyCard {
  return {
    slug: "someone",
    title: "A story",
    member_name: "Someone",
    member_role: null,
    excerpt: null,
    youtube_video_id: "abc123",
    cover_url: null,
    cover_alt: null,
    monthly_revenue_usd: null,
    machine_count: null,
    location_count: null,
    prior_occupation: null,
    location_types: [],
    tags: [],
    published_at: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

describe("matchesRevenueBand", () => {
  it("treats min as inclusive and max as exclusive", () => {
    expect(matchesRevenueBand(10_000, "10k-25k")).toBe(true);
    expect(matchesRevenueBand(25_000, "10k-25k")).toBe(false);
    expect(matchesRevenueBand(25_000, "25k-50k")).toBe(true);
  });

  it("puts an unbounded top band to work", () => {
    expect(matchesRevenueBand(102_000, "50k-plus")).toBe(true);
  });

  it("excludes members with no stated monthly figure", () => {
    // Regression guard: a null must never fall into a band. Members who only
    // gave an annual number would otherwise appear under a monthly claim.
    expect(matchesRevenueBand(null, "50k-plus")).toBe(false);
    expect(matchesRevenueBand(null, "under-10k")).toBe(false);
  });
});

describe("parseCaseStudyFilters", () => {
  it("keeps known values", () => {
    expect(
      parseCaseStudyFilters({ tag: "career-change", revenue: "10k-25k" }, [
        "career-change",
      ]),
    ).toEqual({ tag: "career-change", revenue: "10k-25k" });
  });

  it("drops unknown values instead of returning an empty page", () => {
    expect(
      parseCaseStudyFilters({ tag: "nope", revenue: "bogus" }, [
        "career-change",
      ]),
    ).toEqual({ tag: null, revenue: null });
  });

  it("drops a raw underlying tag, which is no longer a valid chip", () => {
    // `?tag=laid-off` was never a public URL, but a hand-edited one must show
    // everything rather than an empty page.
    expect(
      parseCaseStudyFilters({ tag: "laid-off" }, ["career-change"]).tag,
    ).toBeNull();
  });

  it("takes the first value of a repeated param", () => {
    expect(
      parseCaseStudyFilters({ tag: ["career-change", "scaling"] }, [
        "career-change",
        "scaling",
      ]).tag,
    ).toBe("career-change");
  });
});

describe("applyCaseStudyFilters", () => {
  const caseStudies = [
    card({ slug: "a", tags: ["retiree"], monthly_revenue_usd: 5_500 }),
    card({ slug: "b", tags: ["scaling"], monthly_revenue_usd: 102_000 }),
    card({
      slug: "c",
      tags: ["laid-off", "scaling"],
      monthly_revenue_usd: null,
    }),
  ];

  it("returns everything when nothing is selected", () => {
    expect(
      applyCaseStudyFilters(caseStudies, { tag: null, revenue: null }),
    ).toHaveLength(3);
  });

  it("matches any tag in the group, not just one", () => {
    // `retiree` and `laid-off` both roll up into Career Change.
    const result = applyCaseStudyFilters(caseStudies, {
      tag: "career-change",
      revenue: null,
    });
    expect(result.map((entry) => entry.slug)).toEqual(["a", "c"]);
  });

  it("intersects tag and revenue rather than unioning them", () => {
    const result = applyCaseStudyFilters(caseStudies, {
      tag: "career-change",
      revenue: "under-10k",
    });
    expect(result.map((entry) => entry.slug)).toEqual(["a"]);
  });
});

describe("facets", () => {
  it("keeps groups in declaration order, not count order", () => {
    const facets = buildTagFacets([
      card({ tags: ["scaling"] }),
      card({ tags: ["scaling", "couple"] }),
      card({ tags: ["retiree"] }),
    ]);
    expect(facets.map((facet) => facet.value)).toEqual([
      "career-change",
      "family-couple",
      "scaling",
    ]);
    expect(facets.at(-1)).toMatchObject({ count: 2, label: "Scaling" });
  });

  it("counts a story once per group however many of its tags match", () => {
    // `first-location` and `no-experience` both sit in New to Vending.
    const facets = buildTagFacets([
      card({ tags: ["first-location", "no-experience"] }),
    ]);
    expect(facets).toEqual([
      { value: "new-to-vending", label: "New to Vending", count: 1 },
    ]);
  });

  it("hides groups no story matches", () => {
    expect(
      buildTagFacets([card({ tags: ["part-time"] })]).map((f) => f.value),
    ).toEqual(["part-time"]);
  });

  it("covers every group with an unambiguous chip label", () => {
    const labels = CASE_STUDY_TAG_GROUPS.map((group) => group.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(
      new Set(CASE_STUDY_TAG_GROUPS.flatMap((group) => group.tags)).size,
    ).toBe(CASE_STUDY_TAG_GROUPS.flatMap((group) => group.tags).length);
  });

  it("hides revenue bands that would return nothing", () => {
    const facets = buildRevenueFacets([card({ monthly_revenue_usd: 5_500 })]);
    expect(facets.map((facet) => facet.value)).toEqual(["under-10k"]);
  });
});

describe("caseStudiesHref", () => {
  it("drops the query entirely when no filter is active", () => {
    expect(
      caseStudiesHref({ tag: "career-change", revenue: null }, { tag: null }),
    ).toBe("/case-studies");
  });

  it("preserves the other facet when toggling one", () => {
    expect(
      caseStudiesHref(
        { tag: "career-change", revenue: "under-10k" },
        { tag: null },
      ),
    ).toBe("/case-studies?revenue=under-10k");
  });
});
