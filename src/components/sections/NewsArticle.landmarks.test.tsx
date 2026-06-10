import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsArticle } from "./NewsArticle";

/**
 * S5 (finding C052/C057): the share rail and table-of-contents asides are
 * complementary landmarks. axe's `landmark-complementary-is-top-level` fires
 * when an <aside> is nested inside another landmark, so neither aside may live
 * inside the <article> (a `region`/article landmark). They must be siblings of
 * the article content, not descendants of it.
 *
 * Asserted against rendered markup (renderToStaticMarkup, matching the suite's
 * node environment); the Playwright axe run in the browser gate proves zero
 * `landmark-complementary` violations on the live page.
 */
const html = renderToStaticMarkup(
  <NewsArticle
    post={{
      slug: "sample",
      title: "Sample Vending Location Guide",
      excerpt: "An excerpt.",
      cover_url: null,
      cover_alt: null,
      published_at: "2026-06-01T00:00:00.000Z",
    }}
    html="<h2>Route selection</h2><p>Body copy here.</p>"
  />,
);

/** Returns the substring spanning each top-level <article>…</article> block. */
function articleInnerHtml(source: string): string {
  const open = source.indexOf("<article");
  const close = source.lastIndexOf("</article>");
  if (open === -1 || close === -1) return "";
  return source.slice(open, close);
}

describe("NewsArticle landmark nesting", () => {
  it("renders an article landmark", () => {
    expect(html).toContain("<article");
  });

  it("keeps every <aside> outside the article landmark", () => {
    const inner = articleInnerHtml(html);
    expect(inner).not.toContain("<aside");
  });

  it("still renders the share rail and table-of-contents asides", () => {
    expect(html).toContain('aria-label="Share this article"');
    expect(html).toContain("In this article");
  });
});
