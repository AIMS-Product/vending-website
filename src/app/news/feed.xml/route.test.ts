import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/config", () => ({
  publicConfig: {
    siteUrl: "https://www.vendingpreneurs.com",
  },
}));

vi.mock("@/lib/services/news", () => ({
  listPublishedPosts: vi.fn().mockResolvedValue([
    {
      slug: "launch-ready-vending",
      title: "Launch Ready & Vending",
      excerpt: "A practical <launch> checklist.",
      published_at: "2026-06-20T00:00:00.000Z",
    },
  ]),
}));

describe("/news/feed.xml", () => {
  it("uses the public canonical host for channel and item URLs", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(response.headers.get("Content-Type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
    expect(xml).toContain("<link>https://www.vendingpreneurs.com/news</link>");
    expect(xml).toContain(
      '<atom:link href="https://www.vendingpreneurs.com/news/feed.xml" rel="self" type="application/rss+xml" />',
    );
    expect(xml).toContain(
      "<link>https://www.vendingpreneurs.com/news/launch-ready-vending</link>",
    );
    expect(xml).toContain(
      '<guid isPermaLink="true">https://www.vendingpreneurs.com/news/launch-ready-vending</guid>',
    );
    expect(xml).not.toContain("localhost");
  });

  it("escapes XML text fields", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain("<title>Launch Ready &amp; Vending</title>");
    expect(xml).toContain(
      "<description>A practical &lt;launch&gt; checklist.</description>",
    );
  });
});
