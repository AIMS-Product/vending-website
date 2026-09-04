import { describe, expect, it } from "vitest";
import {
  applyCaseStudyFilters,
  buildLocationFacets,
  buildRevenueFacets,
  buildTagFacets,
  CAREER_TAG_GROUPS,
  caseStudiesHref,
  humanBadges,
  HUMAN_BADGES,
  matchesRevenueBand,
  OBJECTION_TAG_GROUPS,
  parseCaseStudyFilters,
  TAG_AXES,
  WHO_TAG_GROUPS,
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

const NONE = {
  objection: null,
  who: null,
  career: null,
  location: null,
  revenue: null,
} as const;

/** Every id a chip could legitimately carry, for the parser's allow-list. */
const ALL_IDS = {
  objection: OBJECTION_TAG_GROUPS.map((group) => group.id),
  who: WHO_TAG_GROUPS.map((group) => group.id),
  career: CAREER_TAG_GROUPS.map((group) => group.id),
  location: ["apartments", "offices", "medical"],
};

describe("matchesRevenueBand", () => {
  it("treats min as inclusive and max as exclusive", () => {
    expect(matchesRevenueBand(10_000, "10k-25k")).toBe(true);
    expect(matchesRevenueBand(25_000, "10k-25k")).toBe(false);
  });

  it("puts an unbounded top band to work", () => {
    expect(matchesRevenueBand(102_000, "50k-plus")).toBe(true);
  });

  it("excludes members with no stated monthly figure", () => {
    // A null cannot be placed in a band. Including it would make "$50K+"
    // show members who never claimed it.
    expect(matchesRevenueBand(null, "50k-plus")).toBe(false);
  });
});

describe("parseCaseStudyFilters", () => {
  it("keeps known values", () => {
    expect(
      parseCaseStudyFilters(
        { objection: "price", who: "women", revenue: "10k-25k" },
        ALL_IDS,
      ),
    ).toEqual({
      objection: "price",
      who: "women",
      career: null,
      location: null,
      revenue: "10k-25k",
    });
  });

  it("drops unknown values instead of returning an empty page", () => {
    // A stale or hand-edited URL should show everything, not an empty page
    // that reads as "we have no case studies".
    expect(
      parseCaseStudyFilters(
        { objection: "nope", who: "nope", revenue: "nope" },
        ALL_IDS,
      ),
    ).toEqual(NONE);
  });

  it("drops a raw underlying tag, which is no longer a valid chip", () => {
    // `icp-female` is a tag on the story; `women` is the chip. Only the chip
    // is addressable in the URL.
    expect(
      parseCaseStudyFilters({ who: "icp-female" }, ALL_IDS).who,
    ).toBeNull();
  });

  it("drops an axis the caller offered no ids for", () => {
    // Regression guard for the keyed-object signature: an axis missing from
    // `available` must reject everything rather than accept everything.
    expect(parseCaseStudyFilters({ who: "women" }, {}).who).toBeNull();
  });

  it("takes the first value of a repeated param", () => {
    expect(
      parseCaseStudyFilters({ who: ["women", "investor"] }, ALL_IDS).who,
    ).toBe("women");
  });
});

describe("applyCaseStudyFilters", () => {
  const caseStudies = [
    card({
      slug: "a",
      tags: ["icp-female", "objection-price"],
      monthly_revenue_usd: 5_500,
    }),
    card({
      slug: "b",
      tags: ["icp-leaving-w2", "objection-timing"],
      monthly_revenue_usd: 40_000,
    }),
    card({
      slug: "c",
      tags: ["icp-female", "objection-timing"],
      monthly_revenue_usd: null,
    }),
  ];

  it("returns everything when nothing is selected", () => {
    expect(applyCaseStudyFilters(caseStudies, NONE)).toHaveLength(3);
  });

  it("matches any tag in the group, not just one", () => {
    // `from-corporate` and `icp-leaving-w2` both roll up into Leaving a W-2.
    const stories = [
      card({ slug: "old", tags: ["from-corporate"] }),
      card({ slug: "new", tags: ["icp-leaving-w2"] }),
    ];
    expect(
      applyCaseStudyFilters(stories, { ...NONE, who: "leaving-w2" }).map(
        (entry) => entry.slug,
      ),
    ).toEqual(["old", "new"]);
  });

  it("intersects two axes rather than unioning them", () => {
    expect(
      applyCaseStudyFilters(caseStudies, {
        ...NONE,
        who: "women",
        revenue: "under-10k",
      }).map((entry) => entry.slug),
    ).toEqual(["a"]);
  });

  it("filters by the objection a story answers", () => {
    expect(
      applyCaseStudyFilters(caseStudies, { ...NONE, objection: "price" }).map(
        (entry) => entry.slug,
      ),
    ).toEqual(["a"]);
  });
});

describe("merged people axis", () => {
  /*
    The three duplicate pairs the merge removed. Each of these used to render
    as two chips over an identical set of stories, so a visitor had to choose
    between two words for one idea. One chip must now catch both tags.
  */
  it.each([
    ["blue-collar", "icp-blue-collar", "from-trades"],
    ["military", "icp-military", "from-public-safety"],
    ["leaving-w2", "icp-leaving-w2", "from-corporate"],
  ])("%s catches both %s and %s", (chip, icpTag, careerTag) => {
    const stories = [
      card({ slug: "one", tags: [icpTag] }),
      card({ slug: "two", tags: [careerTag] }),
    ];
    expect(applyCaseStudyFilters(stories, { ...NONE, who: chip })).toHaveLength(
      2,
    );
  });

  it("counts a story once even when it carries both merged tags", () => {
    const stories = [
      card({ slug: "both", tags: ["icp-blue-collar", "from-trades"] }),
    ];
    expect(buildTagFacets(stories, WHO_TAG_GROUPS)).toContainEqual({
      value: "blue-collar",
      label: "Blue collar & trades",
      count: 1,
    });
  });

  it.each(["scaling", "career-change", "part-time", "no-experience"])(
    "no longer indexes people by %s, which matched most of the set",
    (tag) => {
      const groups = [...WHO_TAG_GROUPS, ...CAREER_TAG_GROUPS];
      expect(groups.flatMap((group) => group.tags)).not.toContain(tag);
    },
  );

  it("keeps the career row free of tags the people row already claims", () => {
    // Regression guard for the merge: a tag in both rows would double-count a
    // story and put the same person behind two different chips again.
    const who = new Set<string>(WHO_TAG_GROUPS.flatMap((group) => group.tags));
    const overlap = CAREER_TAG_GROUPS.flatMap((group) => group.tags).filter(
      (tag) => who.has(tag),
    );
    expect(overlap).toEqual([]);
  });
});

describe("facets", () => {
  it("keeps groups in declaration order, not count order", () => {
    const stories = [
      card({ slug: "a", tags: ["icp-entrepreneur"] }),
      card({ slug: "b", tags: ["icp-entrepreneur"] }),
      card({ slug: "c", tags: ["icp-leaving-w2"] }),
    ];
    expect(
      buildTagFacets(stories, WHO_TAG_GROUPS).map((facet) => facet.value),
    ).toEqual(["leaving-w2", "entrepreneur"]);
  });

  it("hides groups no story matches", () => {
    // "Contract / Legal" exists in the Objection Library but matches no story
    // here, so it must not render a chip that leads to an empty page.
    const facets = buildTagFacets(
      [card({ tags: ["objection-price"] })],
      OBJECTION_TAG_GROUPS,
    );
    expect(facets.map((facet) => facet.value)).toEqual(["price"]);
  });

  it("gives every group an unambiguous chip label", () => {
    for (const groups of Object.values(TAG_AXES)) {
      const labels = groups.map((group) => group.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("hides revenue bands that would return nothing", () => {
    const facets = buildRevenueFacets([card({ monthly_revenue_usd: 5_500 })]);
    expect(facets.map((facet) => facet.value)).toEqual(["under-10k"]);
  });
});

describe("location axis", () => {
  const stories = [
    card({ slug: "tom", location_types: ["hotel", "student housing"] }),
    card({ slug: "madison", location_types: ["apartments"] }),
    card({ slug: "graham", location_types: ["apartment", "condo"] }),
  ];

  it("collapses spelling variants onto one group", () => {
    // "apartment", "apartments" and "condo" are three stored spellings of one
    // real place and must land in a single chip.
    expect(
      applyCaseStudyFilters(stories, { ...NONE, location: "apartments" }).map(
        (entry) => entry.slug,
      ),
    ).toEqual(["madison", "graham"]);
  });

  it("counts a story once however many of a group's values it carries", () => {
    expect(buildLocationFacets([stories[2]])).toContainEqual({
      value: "apartments",
      label: "Apartments",
      count: 1,
    });
  });

  it("does not let a location group swallow a longer one", () => {
    // Regression guard: "office" must not match "dental office" by substring.
    const dentist = [card({ location_types: ["dental office"] })];
    expect(
      applyCaseStudyFilters(dentist, { ...NONE, location: "offices" }),
    ).toHaveLength(0);
    expect(
      applyCaseStudyFilters(dentist, { ...NONE, location: "medical" }),
    ).toHaveLength(1);
  });
});

describe("caseStudiesHref", () => {
  it("drops the query entirely when no filter is active", () => {
    expect(caseStudiesHref(NONE, {})).toBe("/case-studies");
  });

  it("preserves the other axes when toggling one", () => {
    expect(
      caseStudiesHref(
        { ...NONE, objection: "price", revenue: "10k-25k" },
        { who: "women" },
      ),
    ).toBe("/case-studies?objection=price&who=women&revenue=10k-25k");
  });

  it("clears an axis when it is toggled off", () => {
    expect(caseStudiesHref({ ...NONE, who: "women" }, { who: null })).toBe(
      "/case-studies",
    );
  });
});

describe("humanBadges", () => {
  it("orders by who-they-built-it-with before how-they-felt", () => {
    // The card only has room for two. The spouse is the fact that makes a
    // stranger relatable; burnout is the fact every story shares.
    expect(
      humanBadges(["burned-out", "with-spouse", "raising-kids"], 2),
    ).toEqual(["Built it with their spouse", "Raising kids while building"]);
  });

  it("returns nothing for a story with no human tags", () => {
    expect(humanBadges(["scaling", "first-location"])).toEqual([]);
  });

  it("never surfaces a tag the site deliberately does not index people by", () => {
    // Bereavement, special-needs children and bankruptcy are all evidenced in
    // the bodies and are all deliberately absent. This fails loudly if one is
    // ever added to the badge list.
    const banned = ["bereavement", "special-needs-child", "bankruptcy"];
    const badgeTags = HUMAN_BADGES.map((badge) => badge.tag);
    for (const tag of banned) expect(badgeTags).not.toContain(tag);
  });
});
