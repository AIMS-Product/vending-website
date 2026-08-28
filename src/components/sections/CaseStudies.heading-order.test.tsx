import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseStudyQuotes } from "./CaseStudyQuotes";
import { CaseStudyIndex } from "./CaseStudyIndex";
import { caseStudySectionHeadings } from "@/lib/content/case-studies";
import type { CaseStudyCard } from "@/lib/services/case-studies";

/**
 * S6 (findings C053/C086): /case-studies renders the page h1 (Hero), then
 * sections whose only headings were per-card h3s. axe's `heading-order` fires
 * on the jump from h1 straight to h3 with no intervening h2. Each section
 * carries an h2 so the document outline is sequential (h1 → h2 → h3).
 *
 * The story grid's h2 was screen-reader-only until the second filter row
 * landed; two rows of chips need a visible heading telling the reader what
 * they are filtering. The outline requirement is unchanged either way.
 *
 * The CMS-driven story grid replaced the hardcoded MP4 video wall in the case
 * studies CMS slice; it inherits the same requirement.
 *
 * Asserted against rendered markup; the Playwright axe run in the browser gate
 * proves zero `heading-order` violations on the live page.
 */
const card: CaseStudyCard = {
  slug: "musa-sadi",
  title: "From Rock Bottom to $41K/Month",
  member_name: "Musa Sadi",
  member_role: null,
  excerpt: null,
  youtube_video_id: "kb8ryBm6g9k",
  cover_url: null,
  cover_alt: null,
  monthly_revenue_usd: 41_000,
  machine_count: null,
  location_count: null,
  prior_occupation: null,
  location_types: [],
  tags: ["scaling"],
  published_at: "2026-08-19T00:00:00.000Z",
};

const indexHtml = renderToStaticMarkup(
  <CaseStudyIndex
    caseStudies={[card]}
    filters={{ tag: null, career: null, revenue: null }}
    tagFacets={[{ value: "scaling", label: "Scaling", count: 1 }]}
    careerFacets={[{ value: "corporate", label: "Corporate", count: 1 }]}
    totalCount={1}
  />,
);
const quotesHtml = renderToStaticMarkup(<CaseStudyQuotes />);

/** Heading tags in document order, e.g. ["h2", "h3", "h3"]. */
function headingTags(source: string): string[] {
  return [...source.matchAll(/<(h[1-6])\b/gi)].map((m) => m[1].toLowerCase());
}

describe("CaseStudyIndex heading order", () => {
  it("leads with a visible h2 section heading", () => {
    expect(indexHtml).toContain(caseStudySectionHeadings.stories);
    // Regression guard: it used to be `sr-only`. With two chip rows above the
    // grid, hiding the heading leaves the rows unexplained on screen.
    expect(indexHtml).not.toContain(
      `<h2 class="sr-only">${caseStudySectionHeadings.stories}</h2>`,
    );
  });

  it("renders the section h2 before any card h3", () => {
    expect(headingTags(indexHtml)[0]).toBe("h2");
    expect(
      headingTags(indexHtml)
        .slice(1)
        .every((t) => t === "h3"),
    ).toBe(true);
  });
});

describe("CaseStudyQuotes heading order", () => {
  it("leads with a screen-reader-only h2 section heading", () => {
    expect(quotesHtml).toContain(
      `<h2 class="sr-only">${caseStudySectionHeadings.quotes}</h2>`,
    );
  });

  it("renders the section h2 before any card h3", () => {
    expect(headingTags(quotesHtml)[0]).toBe("h2");
    expect(
      headingTags(quotesHtml)
        .slice(1)
        .every((t) => t === "h3"),
    ).toBe(true);
  });
});
