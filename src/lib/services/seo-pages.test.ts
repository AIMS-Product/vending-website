import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SeoPageValidationError,
  adminArchiveSeoPage,
  adminCreateSeoPage,
  adminGetSeoPageById,
  adminListSeoPages,
  adminPublishSeoPage,
  adminSaveSeoPageDraft,
  adminUpdateSeoPageSlug,
} from "./seo-pages";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import type { Database } from "@/types/database";

const validContent: PageContent = {
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
              id: "block_text",
              type: "rich_text",
              variant: "default",
              props: {
                eyebrow: "",
                heading: "Start a vending route",
                body: {
                  version: 1,
                  nodes: [
                    {
                      type: "paragraph",
                      text: "Validated content keeps public rendering safe.",
                    },
                  ],
                },
              },
            },
            {
              id: "block_image",
              type: "image",
              variant: "standard",
              props: {
                src: "/images/resource-guide.webp",
                altText: "Operator standing beside a vending machine",
                caption: "",
                sourceRightsNotes: "Owned Vendingpreneurs media.",
              },
            },
            {
              id: "block_cta",
              type: "cta",
              variant: "primary",
              props: {
                label: "Apply now",
                href: "/apply",
                trackingName: "resource_apply_cta",
              },
            },
          ],
        },
      ],
    },
  ],
};

type SeoClient = Pick<SupabaseClient<Database>, "from">;

function singleSelect(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, single } };
}

function listSelect(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn().mockReturnValue({ eq });
  const select = vi.fn().mockReturnValue({ order });
  return { table: { select }, mocks: { select, order, eq } };
}

function maybeSingleSelect(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, maybeSingle } };
}

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
}

function inSelect(data: unknown, error: unknown = null) {
  const inMock = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ in: inMock });
  return { table: { select }, mocks: { select, in: inMock } };
}

function updateSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  return { table: { update }, mocks: { update, eq, select, single } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
  } as unknown as SeoClient & { from: ReturnType<typeof vi.fn> };
}

describe("seo page service", () => {
  it("lists pages for admin filters by status", async () => {
    const list = listSelect([{ id: "page_1", status: "draft" }]);
    const client = buildClient(list.table);

    const result = await adminListSeoPages({ status: "draft" }, { client });

    expect(result).toEqual([{ id: "page_1", status: "draft" }]);
    expect(client.from).toHaveBeenCalledWith("seo_pages");
    expect(list.mocks.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    expect(list.mocks.eq).toHaveBeenCalledWith("status", "draft");
  });

  it("loads one page for the admin editor", async () => {
    const page = { id: "page_1", slug: "start-vending" };
    const select = maybeSingleSelect(page);
    const client = buildClient(select.table);

    await expect(adminGetSeoPageById("page_1", { client })).resolves.toBe(page);
    expect(select.mocks.eq).toHaveBeenCalledWith("id", "page_1");
  });

  it("creates a draft page with validated content defaults", async () => {
    const created = { id: "page_1", slug: "start-vending", status: "draft" };
    const insert = insertSingle(created);
    const client = buildClient(insert.table);

    const result = await adminCreateSeoPage(
      {
        slug: "Start Vending",
        title: "Start Vending",
        targetKeyword: "start vending business",
        createdBy: "admin-1",
      },
      { client },
    );

    expect(result).toBe(created);
    expect(client.from).toHaveBeenCalledWith("seo_pages");
    expect(insert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "start-vending",
        title: "Start Vending",
        target_keyword: "start vending business",
        status: "draft",
        created_by: "admin-1",
        draft_content: { version: 1, sections: [] },
      }),
    );
  });

  it("saves a draft only after content schema validation passes", async () => {
    const parsedContent = pageContentSchema.parse(validContent);
    const update = updateSingle({
      id: "page_1",
      draft_content: parsedContent,
      status: "draft",
    });
    const client = buildClient(update.table);

    await adminSaveSeoPageDraft(
      "page_1",
      { draftContent: validContent, updatedBy: "admin-1" },
      { client },
    );

    expect(update.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        draft_content: parsedContent,
        updated_by: "admin-1",
      }),
    );

    await expect(
      adminSaveSeoPageDraft(
        "page_1",
        {
          draftContent: {
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
                        id: "block_1",
                        type: "cta",
                        props: { label: "", href: "javascript:alert(1)" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        { client },
      ),
    ).rejects.toBeInstanceOf(SeoPageValidationError);
  });

  it("publishes by creating an immutable revision and mirroring its snapshot", async () => {
    const parsedContent = pageContentSchema.parse(validContent);
    const page = {
      id: "page_1",
      slug: "start-vending",
      title: "Start Vending",
      status: "draft",
      draft_content: parsedContent,
      seo_title: "Start a Vending Business",
      meta_description: "Learn how to start a vending business safely.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      structured_data_settings: {},
      target_keyword: "start vending business",
    };
    const revision = { id: "revision_1", page_id: "page_1" };
    const published = {
      ...page,
      status: "published",
      published_content: parsedContent,
      published_revision_id: "revision_1",
    };

    const loadPage = singleSelect(page);
    const redirectConflict = maybeSingleSelect(null);
    const insertRevision = insertSingle(revision);
    const updatePage = updateSingle(published);
    const client = buildClient(
      loadPage.table,
      redirectConflict.table,
      insertRevision.table,
      updatePage.table,
    );

    const result = await adminPublishSeoPage("page_1", {
      client,
      actorId: "admin-1",
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(result).toEqual({ page: published, revision });
    expect(insertRevision.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        page_id: "page_1",
        revision_type: "publish",
        content_snapshot: parsedContent,
        created_by: "admin-1",
        seo_snapshot: expect.objectContaining({
          slug: "start-vending",
          seo_title: "Start a Vending Business",
          meta_description: "Learn how to start a vending business safely.",
        }),
      }),
    );
    expect(updatePage.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_content: parsedContent,
        published_revision_id: "revision_1",
        published_at: "2026-05-06T01:00:00.000Z",
        updated_by: "admin-1",
      }),
    );
  });

  it("blocks publish when the page fails publish validation", async () => {
    const page = {
      id: "page_1",
      slug: "start-vending",
      title: "Start Vending",
      status: "draft",
      draft_content: { version: 1, sections: [] },
      seo_title: null,
      meta_description: null,
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      structured_data_settings: {},
      target_keyword: "start vending business",
    };

    const loadPage = singleSelect(page);
    const client = buildClient(loadPage.table);

    await expect(
      adminPublishSeoPage("page_1", { client, actorId: "admin-1" }),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "missing_seo_title" }),
        expect.objectContaining({ code: "missing_conversion_block" }),
      ]),
    });
  });

  it("blocks publish when a referenced image asset lacks rights metadata", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    const draftContent = pageContentSchema.parse({
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: validContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "image"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        assetId,
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });
    const page = {
      id: "page_1",
      slug: "start-vending",
      title: "Start Vending",
      status: "draft",
      draft_content: draftContent,
      seo_title: "Start a Vending Business",
      meta_description: "Learn how to start a vending business safely.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      structured_data_settings: {},
      target_keyword: "start vending business",
    };

    const loadPage = singleSelect(page);
    const redirectConflict = maybeSingleSelect(null);
    const mediaRows = inSelect([
      {
        id: assetId,
        asset_type: "image",
        alt_text: "Operator beside a machine",
        source_rights_notes: "",
      },
    ]);
    const client = buildClient(
      loadPage.table,
      redirectConflict.table,
      mediaRows.table,
    );

    await expect(
      adminPublishSeoPage("page_1", { client, actorId: "admin-1" }),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "missing_media_rights" }),
      ]),
    });
    expect(mediaRows.mocks.in).toHaveBeenCalledWith("id", [assetId]);
  });

  it("resolves media asset metadata into the published snapshot", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    const draftContent = pageContentSchema.parse({
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: validContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "image"
                  ? {
                      ...block,
                      props: {
                        assetId,
                        src: "",
                        altText: "",
                        caption: "",
                        sourceRightsNotes: "",
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });
    const resolvedContent = pageContentSchema.parse({
      ...draftContent,
      sections: [
        {
          ...draftContent.sections[0],
          columns: [
            {
              ...draftContent.sections[0].columns[0],
              blocks: draftContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "image"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        src: "https://cdn.example.com/asset.webp",
                        altText: "Operator beside a machine",
                        sourceRightsNotes: "Licensed campaign image.",
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });
    const page = {
      id: "page_1",
      slug: "start-vending",
      title: "Start Vending",
      status: "draft",
      draft_content: draftContent,
      seo_title: "Start a Vending Business",
      meta_description: "Learn how to start a vending business safely.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      structured_data_settings: {},
      target_keyword: "start vending business",
    };
    const revision = { id: "revision_1", page_id: "page_1" };
    const published = {
      ...page,
      status: "published",
      published_content: resolvedContent,
      published_revision_id: "revision_1",
    };

    const loadPage = singleSelect(page);
    const redirectConflict = maybeSingleSelect(null);
    const mediaRows = inSelect([
      {
        id: assetId,
        asset_type: "image",
        alt_text: "Operator beside a machine",
        source_rights_notes: "Licensed campaign image.",
        storage_bucket: null,
        storage_path: null,
        external_url: "https://cdn.example.com/asset.webp",
      },
    ]);
    const insertRevision = insertSingle(revision);
    const updatePage = updateSingle(published);
    const client = buildClient(
      loadPage.table,
      redirectConflict.table,
      mediaRows.table,
      insertRevision.table,
      updatePage.table,
    );

    await adminPublishSeoPage("page_1", {
      client,
      actorId: "admin-1",
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(insertRevision.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_snapshot: resolvedContent,
      }),
    );
    expect(updatePage.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        published_content: resolvedContent,
      }),
    );
  });

  it("resolves reusable CTA presets and proof items into publish snapshots", async () => {
    const ctaPresetId = "22222222-2222-4222-8222-222222222222";
    const proofItemId = "33333333-3333-4333-8333-333333333333";
    const draftContent = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_1",
          columns: [
            {
              id: "column_1",
              blocks: [
                {
                  id: "block_proof",
                  type: "proof",
                  props: {
                    proofItemId,
                    eyebrow: "",
                    body: "",
                    name: "",
                    context: "",
                  },
                },
                {
                  id: "block_cta",
                  type: "cta",
                  props: {
                    presetId: ctaPresetId,
                    label: "",
                    href: "",
                    trackingName: "",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    const resolvedContent = pageContentSchema.parse({
      ...draftContent,
      sections: [
        {
          ...draftContent.sections[0],
          columns: [
            {
              ...draftContent.sections[0].columns[0],
              blocks: [
                {
                  ...draftContent.sections[0].columns[0].blocks[0],
                  variant: "quote",
                  props: {
                    proofItemId,
                    eyebrow: "",
                    body: "This program helped me launch.",
                    name: "Operator",
                    context: "Student",
                  },
                },
                {
                  ...draftContent.sections[0].columns[0].blocks[1],
                  variant: "secondary",
                  props: {
                    presetId: ctaPresetId,
                    label: "Apply today",
                    href: "/apply",
                    trackingName: "library_apply_cta",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    const page = {
      id: "page_1",
      slug: "start-vending",
      title: "Start Vending",
      status: "draft",
      draft_content: draftContent,
      seo_title: "Start a Vending Business",
      meta_description: "Learn how to start a vending business safely.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      structured_data_settings: {},
      target_keyword: "start vending business",
    };
    const loadPage = singleSelect(page);
    const ctaRows = inSelect([
      {
        id: ctaPresetId,
        label: "Apply today",
        href: "/apply",
        style_preset: "secondary",
        tracking_name: "library_apply_cta",
      },
    ]);
    const proofRows = inSelect([
      {
        id: proofItemId,
        kind: "testimonial",
        name: "Operator",
        role_or_context: "Student",
        body: "This program helped me launch.",
        source_rights_notes: "Approved testimonial.",
        approved: true,
      },
    ]);
    const redirectConflict = maybeSingleSelect(null);
    const insertRevision = insertSingle({ id: "revision_1" });
    const updatePage = updateSingle({
      ...page,
      status: "published",
      published_content: resolvedContent,
    });
    const client = buildClient(
      loadPage.table,
      ctaRows.table,
      proofRows.table,
      redirectConflict.table,
      insertRevision.table,
      updatePage.table,
    );

    await adminPublishSeoPage("page_1", {
      client,
      actorId: "admin-1",
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(insertRevision.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ content_snapshot: resolvedContent }),
    );
    expect(updatePage.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ published_content: resolvedContent }),
    );
  });

  it("creates a database redirect when a published page slug changes", async () => {
    const existing = {
      id: "page_1",
      slug: "start-vending",
      status: "published",
    };
    const updated = { ...existing, slug: "start-vending-machine-business" };
    const loadPage = singleSelect(existing);
    const redirectInsert = insertSingle({ id: "redirect_1" });
    const updatePage = updateSingle(updated);
    const client = buildClient(
      loadPage.table,
      redirectInsert.table,
      updatePage.table,
    );

    const result = await adminUpdateSeoPageSlug(
      "page_1",
      "start-vending-machine-business",
      {
        client,
        actorId: "admin-1",
      },
    );

    expect(result).toBe(updated);
    expect(redirectInsert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_path: "/resources/start-vending",
        destination_path: "/resources/start-vending-machine-business",
        status_code: 301,
        page_id: "page_1",
        created_reason: "slug_changed",
        created_by: "admin-1",
      }),
    );
    expect(updatePage.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "start-vending-machine-business",
        updated_by: "admin-1",
      }),
    );
  });

  it("archives a page without mutating the published snapshot", async () => {
    const update = updateSingle({
      id: "page_1",
      status: "archived",
      published_content: validContent,
    });
    const client = buildClient(update.table);

    await adminArchiveSeoPage("page_1", {
      client,
      actorId: "admin-1",
      now: () => new Date("2026-05-06T02:00:00.000Z"),
    });

    const patch = update.mocks.update.mock.calls[0]?.[0];
    expect(patch).toEqual(
      expect.objectContaining({
        status: "archived",
        archived_at: "2026-05-06T02:00:00.000Z",
        archive_behavior: "not_found",
        updated_by: "admin-1",
      }),
    );
    expect(patch).not.toHaveProperty("published_content");
  });

  it("can create a manual database redirect row for builder-managed redirects", async () => {
    const insert = insertSingle({ id: "redirect_1" });
    const update = updateSingle({ id: "page_1", status: "archived" });
    const client = buildClient(insert.table, update.table);

    await adminArchiveSeoPage("page_1", {
      client,
      actorId: "admin-1",
      archiveBehavior: "redirect",
      archiveRedirectUrl: "/resources/start-vending",
      currentSlug: "old-vending-guide",
    });

    expect(insert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_path: "/resources/old-vending-guide",
        destination_path: "/resources/start-vending",
        status_code: 301,
        created_reason: "page_archived",
      }),
    );
  });
});
