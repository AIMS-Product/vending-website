import { describe, expect, it, vi } from "vitest";
import { type PageContent } from "@/lib/page-builder/blocks";
import { adminListInternalLinkTargets } from "./seo-internal-link-index";

const publishedContent: PageContent = {
  version: 1,
  sections: [
    {
      id: "section_1",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "column_1",
          width: "1/1",
          blocks: [
            {
              id: "block_hero",
              type: "hero",
              variant: "standard",
              props: {
                eyebrow: "",
                heading: "Start a vending route",
                body: "Learn how route planning works before applying.",
                ctaLabel: "Apply now",
                ctaHref: "/apply",
                ctaTrackingName: "hero_apply",
              },
            },
            {
              id: "block_text",
              type: "rich_text",
              variant: "default",
              props: {
                eyebrow: "",
                heading: "Location planning",
                body: {
                  version: 1,
                  nodes: [
                    {
                      type: "paragraph",
                      spans: [
                        { text: "Compare " },
                        { text: "startup costs", href: "/resources/costs" },
                        { text: " before you buy machines." },
                      ],
                    },
                    {
                      type: "heading",
                      level: 2,
                      text: "Choose locations carefully",
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

function listQuery(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    then: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.then.mockImplementation((resolve, reject) =>
    Promise.resolve({ data, error }).then(resolve, reject),
  );
  return query;
}

function buildClient(query: ReturnType<typeof listQuery>) {
  return {
    from: vi.fn().mockReturnValue(query),
  };
}

describe("seo internal link index service", () => {
  it("lists published indexable resource pages as internal link targets", async () => {
    const query = listQuery([
      {
        id: "page_1",
        slug: "start-vending",
        title: "Start Vending",
        target_keyword: "start vending",
        meta_description: "A route planning guide.",
        published_content: publishedContent,
        updated_at: "2026-05-06T00:00:00Z",
      },
    ]);
    const client = buildClient(query);

    const targets = await adminListInternalLinkTargets({}, { client });

    expect(client.from).toHaveBeenCalledWith("seo_pages");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.eq).toHaveBeenCalledWith("noindex", false);
    expect(query.eq).toHaveBeenCalledWith("sitemap_enabled", true);
    expect(targets).toEqual([
      expect.objectContaining({
        pageId: "page_1",
        slug: "start-vending",
        path: "/resources/start-vending",
        title: "Start Vending",
        targetKeyword: "start vending",
        summary: "A route planning guide.",
        outgoingInternalLinks: [
          expect.objectContaining({ href: "/apply", label: "Apply now" }),
          expect.objectContaining({
            href: "/resources/costs",
            label: "startup costs",
          }),
        ],
      }),
    ]);
    expect(targets[0]?.headings).toEqual(
      expect.arrayContaining([
        "Start a vending route",
        "Location planning",
        "Choose locations carefully",
      ]),
    );
  });

  it("excludes the current page from candidate targets", async () => {
    const query = listQuery([
      {
        id: "page_1",
        slug: "start-vending",
        title: "Start Vending",
        target_keyword: null,
        meta_description: null,
        published_content: publishedContent,
        updated_at: "2026-05-06T00:00:00Z",
      },
    ]);

    await expect(
      adminListInternalLinkTargets(
        { currentPageId: "page_1" },
        { client: buildClient(query) },
      ),
    ).resolves.toEqual([]);
  });

  it("skips rows with invalid published content", async () => {
    const query = listQuery([
      {
        id: "page_1",
        slug: "bad-content",
        title: "Bad Content",
        target_keyword: null,
        meta_description: null,
        published_content: { version: 2, sections: [] },
        updated_at: "2026-05-06T00:00:00Z",
      },
    ]);

    await expect(
      adminListInternalLinkTargets({}, { client: buildClient(query) }),
    ).resolves.toEqual([]);
  });
});
