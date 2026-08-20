import { describe, expect, it } from "vitest";
import {
  buildCaseStudiesListState,
  parseCaseStudiesListParams,
  type CaseStudyListItem,
} from "@/lib/admin/case-studies-list";

const baseCaseStudy: CaseStudyListItem = {
  id: "case_study_1",
  slug: "member-story",
  title: "Member story",
  member_name: "Jane Doe",
  member_role: "Route owner",
  excerpt: "A member story.",
  youtube_video_id: "dQw4w9WgXcQ",
  quote: null,
  quote_attribution: null,
  body: "Body",
  cover_url: null,
  cover_alt: null,
  stats: [],
  monthly_revenue_usd: null,
  machine_count: null,
  location_count: null,
  months_to_result: null,
  prior_occupation: null,
  location_types: [],
  tags: [],
  related_slugs: [],
  status: "published",
  published_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
  featured: false,
  updated_at: "2026-06-01T00:00:00.000Z",
};

function caseStudy(
  overrides: Partial<CaseStudyListItem> = {},
): CaseStudyListItem {
  return { ...baseCaseStudy, ...overrides };
}

describe("case studies list date filter", () => {
  it("filters case studies updated on or after the selected date", () => {
    const state = buildCaseStudiesListState(
      [
        caseStudy({
          id: "old",
          updated_at: "2026-06-09T23:59:59.000Z",
        }),
        caseStudy({
          id: "same_day",
          updated_at: "2026-06-10T00:00:00.000Z",
        }),
        caseStudy({
          id: "newer",
          updated_at: "2026-06-12T12:00:00.000Z",
        }),
      ],
      parseCaseStudiesListParams({ updatedFrom: "2026-06-10" }),
    );

    expect(state.filteredCaseStudies.map((row) => row.id)).toEqual([
      "newer",
      "same_day",
    ]);
  });
});

describe("case studies list search", () => {
  it("matches on member name as well as title/slug/excerpt", () => {
    const state = buildCaseStudiesListState(
      [
        caseStudy({ id: "match", member_name: "Alex Rivera" }),
        caseStudy({ id: "no-match", member_name: "Sam Lee", title: "Other" }),
      ],
      parseCaseStudiesListParams({ q: "rivera" }),
    );

    expect(state.filteredCaseStudies.map((row) => row.id)).toEqual(["match"]);
  });
});
