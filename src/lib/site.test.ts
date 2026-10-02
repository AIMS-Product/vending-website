import { describe, expect, it } from "vitest";
import { absoluteUrl, pageOpenGraph, siteName, siteUrl } from "./site";

describe("pageOpenGraph", () => {
  it("carries the page's own title, description and path", () => {
    const og = pageOpenGraph("About", "About Mike.", "/about");
    expect(og).toMatchObject({
      title: "About",
      description: "About Mike.",
      url: "/about",
      siteName,
      type: "website",
    });
  });

  it("carries the default 1200x630 share image", () => {
    expect(pageOpenGraph("A", "a", "/a").images).toEqual([
      expect.objectContaining({
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
      }),
    ]);
  });

  it("gives two pages different og:url values", () => {
    const a = pageOpenGraph("A", "a", "/a");
    const b = pageOpenGraph("B", "b", "/b");
    expect(a).not.toEqual(b);
    expect(a).toHaveProperty("url", "/a");
    expect(b).toHaveProperty("url", "/b");
  });
});

describe("absoluteUrl", () => {
  it("resolves a path against the site URL", () => {
    expect(absoluteUrl("/about")).toBe(`${siteUrl}/about`);
  });
});
