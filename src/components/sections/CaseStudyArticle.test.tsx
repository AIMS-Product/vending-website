import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseStudyArticle } from "./CaseStudyArticle";

const caseStudy = {
  slug: "musa-sadi",
  title: "From Rock Bottom to $41K/Month",
  member_name: "Musa Sadi",
  member_role: "Former hospitality manager",
  excerpt: "How one member built a route in under a year.",
  youtube_video_id: "kb8ryBm6g9k",
  quote: "I had nothing left to lose.",
  quote_attribution: "Musa Sadi",
  cover_url: null,
  cover_alt: null,
  stats: [
    { label: "Monthly Revenue", value: "$41K" },
    { label: "Machines", value: "26" },
  ],
  published_at: "2026-08-19T00:00:00.000Z",
  prior_occupation: "High school teacher",
  location_types: ["office", "retirement-community"],
  machine_count: 26,
  location_count: 22,
  months_to_result: 11,
};

const html =
  "<h2>Background</h2><p>Text.</p><h2>The Challenge</h2><p>Text.</p>";

function render(overrides = {}, related: never[] = []) {
  return renderToStaticMarkup(
    <CaseStudyArticle
      caseStudy={{ ...caseStudy, ...overrides }}
      html={html}
      related={related}
    />,
  );
}

describe("CaseStudyArticle", () => {
  it("produces a sequential h1 -> h2 heading outline", () => {
    const levels = [...render().matchAll(/<(h[1-6])\b/gi)].map((match) =>
      match[1].toLowerCase(),
    );
    expect(levels[0]).toBe("h1");
    expect(levels.slice(1).every((level) => level !== "h1")).toBe(true);
  });

  it("links the breadcrumb back to the case studies index, not the news index", () => {
    const markup = render();
    expect(markup).toContain('href="/case-studies"');
    expect(markup).not.toContain('href="/news"');
  });

  it("renders the pull quote and its attribution", () => {
    const markup = render();
    expect(markup).toContain("I had nothing left to lose.");
    expect(markup).toContain("Musa Sadi");
  });

  it("renders every stat", () => {
    const markup = render();
    expect(markup).toContain("$41K");
    expect(markup).toContain("Monthly Revenue");
    expect(markup).toContain("26");
  });

  it("does not mount a YouTube iframe before the visitor presses play", () => {
    // The embed is a click-to-play facade. If an iframe ships in the initial
    // markup, the largest asset on the page is back on the critical path.
    expect(render()).not.toContain("<iframe");
  });

  it("omits the quote block entirely when there is no quote", () => {
    expect(render({ quote: null })).not.toContain("<blockquote");
  });

  it("omits the stats strip when stats are malformed rather than crashing", () => {
    const markup = render({ stats: [{ label: "Revenue", value: 41000 }] });
    expect(markup).not.toContain("Results at a glance");
  });

  it("survives a row with no video and no cover image", () => {
    expect(() =>
      render({ youtube_video_id: null, cover_url: null }),
    ).not.toThrow();
  });

  it("hides the related rail when there is nothing to show", () => {
    expect(render()).not.toContain("More success stories");
  });
});
