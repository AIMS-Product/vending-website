import { describe, expect, it } from "vitest";
import {
  extractFaqEntries,
  newsArticleStructuredData,
  newsStructuredData,
} from "./structured-data";

const body = [
  "Intro paragraph.",
  "",
  "## Some other section",
  "",
  "**This bold line is not in the FAQ section** and must be ignored.",
  "",
  "## Frequently asked questions",
  "**What are the highest-traffic areas?**",
  "Places where people wait with [no alternative](https://example.com) nearby.",
  "",
  "**Where are machines most profitable?**",
  "Medical outpatient facilities and **class A** apartment buildings.",
  "",
  "## Next section",
  "",
  "**Not a question** — this is past the FAQ.",
].join("\n");

describe("extractFaqEntries", () => {
  it("reads only the pairs inside the FAQ section", () => {
    expect(extractFaqEntries(body)).toEqual([
      {
        question: "What are the highest-traffic areas?",
        answer: "Places where people wait with no alternative nearby.",
      },
      {
        question: "Where are machines most profitable?",
        answer:
          "Medical outpatient facilities and class A apartment buildings.",
      },
    ]);
  });

  it("returns nothing when the post has no FAQ section", () => {
    expect(extractFaqEntries("## Intro\n\nJust prose.")).toEqual([]);
  });

  it("drops a question with no answer rather than emitting an empty one", () => {
    const dangling = "## Frequently asked questions\n**Unanswered?**\n";
    expect(extractFaqEntries(dangling)).toEqual([]);
  });
});

describe("newsStructuredData", () => {
  it("emits a FAQPage graph", () => {
    expect(newsStructuredData(body)).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What are the highest-traffic areas?" },
        { "@type": "Question", name: "Where are machines most profitable?" },
      ],
    });
  });

  it("emits nothing when there are no entries", () => {
    expect(newsStructuredData("No FAQ here.")).toBeNull();
  });
});

describe("newsArticleStructuredData", () => {
  const post = {
    slug: "best-vending-locations",
    title: "Best Vending Locations",
    excerpt: "Where to place machines.",
    cover_url: "/images/news/cover.jpg",
    published_at: "2026-06-20T00:00:00.000Z",
  };

  it("describes the post from its own columns", () => {
    const graph = newsArticleStructuredData(post);
    expect(graph).toMatchObject({
      "@type": "Article",
      headline: "Best Vending Locations",
      description: "Where to place machines.",
      datePublished: "2026-06-20T00:00:00.000Z",
      publisher: { "@type": "Organization", name: "Vendingpreneurs" },
    });
    expect(graph.mainEntityOfPage["@id"]).toMatch(
      /\/news\/best-vending-locations$/,
    );
    expect(graph.image?.[0]).toMatch(
      /^https?:\/\/.+\/images\/news\/cover\.jpg$/,
    );
  });

  it("omits optional fields instead of emitting them empty", () => {
    const graph = newsArticleStructuredData({
      ...post,
      excerpt: null,
      cover_url: null,
      published_at: null,
    });
    expect(graph).not.toHaveProperty("description");
    expect(graph).not.toHaveProperty("image");
    expect(graph).not.toHaveProperty("datePublished");
  });

  it("keeps an absolute cover URL as written", () => {
    const graph = newsArticleStructuredData({
      ...post,
      cover_url: "https://cdn.example.com/a.jpg",
    });
    expect(graph.image).toEqual(["https://cdn.example.com/a.jpg"]);
  });
});
