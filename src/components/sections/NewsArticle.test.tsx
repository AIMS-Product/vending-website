import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsArticle } from "./NewsArticle";

const post = {
  slug: "how-to-choose-the-perfect-location-for-vending-machine",
  title: "How to choose the perfect location for a vending machine",
  excerpt: "A short excerpt.",
  cover_url: null,
  cover_alt: null,
  published_at: "2026-01-01T00:00:00.000Z",
};

describe("NewsArticle breadcrumb", () => {
  it("links to /news with the label News", () => {
    const html = renderToStaticMarkup(
      <NewsArticle post={post} html="<p>Body</p>" />,
    );

    const newsLink = html.match(/<a[^>]*href="\/news"[^>]*>(.*?)<\/a>/);
    expect(newsLink).not.toBeNull();
    expect(newsLink?.[1]).toBe("News");
  });

  it("does not label the breadcrumb as Blog", () => {
    const html = renderToStaticMarkup(
      <NewsArticle post={post} html="<p>Body</p>" />,
    );

    const newsLink = html.match(/<a[^>]*href="\/news"[^>]*>(.*?)<\/a>/);
    expect(newsLink?.[1]).not.toBe("Blog");
  });
});
