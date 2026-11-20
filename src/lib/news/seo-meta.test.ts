import { describe, expect, it } from "vitest";
import { newsMetaDescription, newsSeoTitle } from "@/lib/news/seo-meta";

const long =
  "Most new operators ask the same question before buying a first machine: how much does a vending machine actually make once you take out product, location share, card fees and your own time, and how long until it pays for itself?";

describe("newsSeoTitle", () => {
  it("prefers the SEO title and falls back to the post title", () => {
    expect(
      newsSeoTitle({ title: "Post", excerpt: null, seo_title: "Short" }),
    ).toBe("Short");
    expect(
      newsSeoTitle({ title: "Post", excerpt: null, seo_title: "  " }),
    ).toBe("Post");
  });
});

describe("newsMetaDescription", () => {
  it("prefers the meta description", () => {
    expect(
      newsMetaDescription({
        title: "T",
        excerpt: long,
        meta_description: "Own.",
      }),
    ).toBe("Own.");
  });

  it("cuts a long excerpt at a whole word, at most 155 characters", () => {
    const out = newsMetaDescription({ title: "T", excerpt: long })!;
    expect(out.length).toBeLessThanOrEqual(155);
    expect(long.startsWith(out)).toBe(true);
    expect(long[out.length]).toMatch(/[\s,]/);
    expect(out).not.toMatch(/[\s,]$/);
  });

  it("keeps a short excerpt as is, and returns undefined with none", () => {
    expect(newsMetaDescription({ title: "T", excerpt: "Short one." })).toBe(
      "Short one.",
    );
    expect(newsMetaDescription({ title: "T", excerpt: null })).toBeUndefined();
  });
});
