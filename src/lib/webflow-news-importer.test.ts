import { describe, expect, it } from "vitest";

const { decideDraftWrite, extractNewsDraftFromHtml } =
  await import("../../scripts/import-webflow-news-drafts.mjs");

describe("Webflow news draft importer", () => {
  it("extracts a sanitized draft candidate from article HTML", () => {
    const draft = extractNewsDraftFromHtml(
      `
        <html>
          <head>
            <meta name="description" content="A practical vending guide.">
            <meta property="og:image" content="https://cdn.prod.website-files.com/cover.jpg">
          </head>
          <body>
            <main>
              <h1>Vending Machine Guide</h1>
              <p>Start with the right location.</p>
              <h2>First steps</h2>
              <p>Ask about traffic and access.</p>
              <script>alert("nope")</script>
            </main>
          </body>
        </html>
      `,
      "/news/vending-machine-guide",
    );

    expect(draft).toMatchObject({
      slug: "vending-machine-guide",
      title: "Vending Machine Guide",
      excerpt: "A practical vending guide.",
      cover_url: "https://cdn.prod.website-files.com/cover.jpg",
      status: "draft",
      published_at: null,
    });
    expect(draft.body).toContain("Start with the right location.");
    expect(draft.body).toContain("## First steps");
    expect(draft.body).not.toContain("<script");
  });

  it("skips existing reviewed rows unless draft overwrite is explicit", () => {
    expect(decideDraftWrite(null)).toBe("insert");
    expect(decideDraftWrite({ status: "published" }, true)).toBe(
      "skip-existing",
    );
    expect(decideDraftWrite({ status: "draft" }, false)).toBe("skip-existing");
    expect(decideDraftWrite({ status: "draft" }, true)).toBe("overwrite-draft");
  });
});
