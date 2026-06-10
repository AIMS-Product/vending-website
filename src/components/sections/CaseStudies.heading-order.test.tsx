import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseStudyQuotes } from "./CaseStudyQuotes";
import { CaseStudyVideos } from "./CaseStudyVideos";
import { caseStudySectionHeadings } from "@/lib/content/case-studies";

/**
 * S6 (findings C053/C086): /case-studies renders the page h1 (Hero), then video
 * and quote sections whose only headings were per-card h3s. axe's `heading-order`
 * fires on the jump from h1 straight to h3 with no intervening h2. Each section
 * now carries a screen-reader-only h2 so the document outline is sequential
 * (h1 → h2 → h3) without changing the visual design.
 *
 * Asserted against rendered markup; the Playwright axe run in the browser gate
 * proves zero `heading-order` violations on the live page.
 */
const videosHtml = renderToStaticMarkup(<CaseStudyVideos />);
const quotesHtml = renderToStaticMarkup(<CaseStudyQuotes />);

/** Heading tags in document order, e.g. ["h2", "h3", "h3"]. */
function headingTags(source: string): string[] {
  return [...source.matchAll(/<(h[1-6])\b/gi)].map((m) => m[1].toLowerCase());
}

describe("CaseStudyVideos heading order", () => {
  it("leads with a screen-reader-only h2 section heading", () => {
    expect(videosHtml).toContain(
      `<h2 class="sr-only">${caseStudySectionHeadings.videos}</h2>`,
    );
  });

  it("renders the section h2 before any card h3", () => {
    expect(headingTags(videosHtml)[0]).toBe("h2");
    expect(
      headingTags(videosHtml)
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
