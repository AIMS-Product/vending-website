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

describe("CaseStudyIndex filter rows", () => {
  const facets = {
    objection: [{ value: "price", label: "Can I afford it?", count: 1 }],
    who: [{ value: "women", label: "Women in vending", count: 1 }],
    career: [{ value: "healthcare", label: "Healthcare", count: 1 }],
    revenue: [],
    location: [],
  };
  const filters = {
    objection: null,
    who: null,
    career: null,
    location: null,
    revenue: null,
  };
  const props = {
    caseStudies: [card({ tags: ["from-healthcare"] })],
    filters,
    facets,
    totalCount: 1,
  };

  it("shows the two primary rows without a disclosure", () => {
    const markup = renderToStaticMarkup(<CaseStudyIndex {...props} />);
    const summaryAt = markup.indexOf("More filters");
    expect(markup).toContain("What&#x27;s holding you back");
    expect(markup).toContain("Who they are");
    // Both primary rows must sit above the disclosure, not inside it.
    expect(markup.indexOf("Who they are")).toBeLessThan(summaryAt);
  });

  it("keeps the refining rows behind the disclosure", () => {
    const markup = renderToStaticMarkup(<CaseStudyIndex {...props} />);
    expect(markup).toContain("?career=healthcare");
    expect(markup.indexOf("The job they left")).toBeGreaterThan(
      markup.indexOf("More filters"),
    );
    expect(markup).not.toContain('<details class="group mt-6" open');
  });

  it("opens the disclosure when one of its own filters is active", () => {
    // Otherwise a shared ?career=healthcare link looks like it filtered
    // nothing: the grid narrows but the active chip is hidden.
    const markup = renderToStaticMarkup(
      <CaseStudyIndex
        {...props}
        filters={{ ...filters, career: "healthcare" }}
      />,
    );
    expect(markup).toContain('open=""');
  });

  it("leaves the disclosure shut when only a primary filter is active", () => {
    const markup = renderToStaticMarkup(
      <CaseStudyIndex {...props} filters={{ ...filters, who: "women" }} />,
    );
    expect(markup).not.toContain('open=""');
  });

  it("hides a row entirely when it has no facets", () => {
    // The real failure mode before a backfill runs: every facet is empty and
    // an empty labelled row renders as a stray heading over nothing.
    const markup = renderToStaticMarkup(
      <CaseStudyIndex {...props} facets={{ ...facets, career: [] }} />,
    );
    expect(markup).not.toContain("The job they left");
    expect(markup).toContain("Who they are");
  });
});
