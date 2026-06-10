import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsList } from "./NewsList";

const post = {
  id: "1",
  slug: "first-post",
  title: "First Post Title",
  excerpt: "A short excerpt.",
  cover_url: "https://cdn.example.com/cover.jpg",
  cover_alt: "Cover alt text",
  published_at: "2026-01-01T00:00:00.000Z",
};

describe("NewsList card", () => {
  it("renders title, excerpt, date, and a link to the article", () => {
    const html = renderToStaticMarkup(<NewsList posts={[post]} />);

    expect(html).toContain("First Post Title");
    expect(html).toContain("A short excerpt.");
    expect(html).toContain("Jan 1, 2026");
    expect(html).toContain('href="/news/first-post"');
  });

  it("renders the image with explicit fill dimensions in the happy path", () => {
    const html = renderToStaticMarkup(<NewsList posts={[post]} />);

    // next/image fill mode sets position:absolute + 100% sizing on the <img>.
    expect(html).toContain("<img");
    expect(html).not.toContain('data-image-fallback="true"');
  });

  it("falls back to the solid block when a post has no cover", () => {
    const html = renderToStaticMarkup(
      <NewsList posts={[{ ...post, cover_url: null, cover_alt: null }]} />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("First Post Title");
  });

  it("renders cards visible on first paint (no scroll-reveal hidden state)", () => {
    // C005 guard: cards must not start hidden behind a scroll-reveal
    // animation, which made the page look blank/half-loaded above the fold.
    const html = renderToStaticMarkup(<NewsList posts={[post]} />);

    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("invisible");
    expect(html).not.toContain('data-reveal="false"');
  });
});
