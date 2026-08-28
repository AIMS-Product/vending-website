import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseStudyIndex } from "./CaseStudyIndex";
import { CaseStudyCard } from "./CaseStudyCard";
import type { CaseStudyCard as CaseStudyCardData } from "@/lib/services/case-studies";

function card(overrides: Partial<CaseStudyCardData> = {}): CaseStudyCardData {
  return {
    slug: "mallerie-rouch",
    title: "A story",
    member_name: "Mallorie Rauch",
    member_role: "Licensed physician assistant",
    excerpt: null,
    youtube_video_id: "abc123",
    cover_url: null,
    cover_alt: null,
    monthly_revenue_usd: null,
    machine_count: null,
    location_count: null,
    prior_occupation: "Licensed physician assistant",
    location_types: [],
    tags: [],
    published_at: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

describe("CaseStudyCard human badges", () => {
  it("shows at most two badges, highest priority first", () => {
    const markup = renderToStaticMarkup(
      <CaseStudyCard
        caseStudy={card({
          tags: ["burned-out", "with-spouse", "raising-kids", "built-solo"],
        })}
      />,
    );
    expect(markup).toContain("Built it with their spouse");
    expect(markup).toContain("Raising kids while building");
    expect(markup).not.toContain("Burned out");
  });

  it("renders no badge list at all for a story with no human tags", () => {
    const markup = renderToStaticMarkup(
      <CaseStudyCard caseStudy={card({ tags: ["scaling"] })} />,
    );
    expect(markup).not.toContain("<ul");
  });
});

describe("CaseStudyIndex second filter row", () => {
  const props = {
    caseStudies: [card({ tags: ["from-healthcare"] })],
    filters: { tag: null, career: null, revenue: null },
    tagFacets: [{ value: "scaling", label: "Scaling", count: 1 }],
    totalCount: 1,
  };

  it("renders both rows with distinct accessible names", () => {
    const markup = renderToStaticMarkup(
      <CaseStudyIndex
        {...props}
        careerFacets={[{ value: "healthcare", label: "Healthcare", count: 1 }]}
      />,
    );
    expect(markup).toContain("Their situation");
    expect(markup).toContain("What they did before");
    expect(markup).toContain("?career=healthcare");
  });

  it("hides the career row entirely when no story has a career tag", () => {
    // The real failure mode before the backfill runs: Supabase still holds the
    // old tags, every career facet is empty, and an empty labelled row would
    // render as a stray heading over nothing.
    const markup = renderToStaticMarkup(
      <CaseStudyIndex {...props} careerFacets={[]} />,
    );
    expect(markup).not.toContain("What they did before");
    expect(markup).toContain("Their situation");
  });
});
