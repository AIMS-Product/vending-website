import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminCreateSeoPagePreviewToken,
  adminRollbackSeoPageRevision,
  getSeoPagePreviewByToken,
  hasActiveSeoPagePreviewToken,
} from "./seo-pages";
import type { PageContent } from "@/lib/page-builder/blocks";
import type { Database } from "@/types/database";

type SeoClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

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
                heading: "Preview-safe content",
                body: {
                  version: 1,
                  nodes: [{ type: "paragraph", text: "Draft text." }],
                },
              },
            },
            {
              id: "block_cta",
              type: "cta",
              variant: "primary",
              props: {
                label: "Apply now",
                href: "/apply",
                trackingName: "preview_apply",
              },
            },
          ],
        },
      ],
    },
  ],
};

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
}

function maybeSingleByEq(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, maybeSingle } };
}

function maybeSingleByMatch(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const match = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ match });
  return { table: { select }, mocks: { select, match, maybeSingle } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Unexpected Supabase RPC call" },
    }),
  } as unknown as SeoClient & {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };
}

describe("seo page revisions and previews", () => {
  it("creates preview tokens without storing the raw secret", async () => {
    const inserted = {
      id: "token_1",
      page_id: "page_1",
      token_prefix: "preview-",
      expires_at: "2026-05-09T01:00:00.000Z",
      revoked_at: null,
      created_by: "admin_1",
      created_at: "2026-05-06T01:00:00.000Z",
    };
    const insert = insertSingle(inserted);
    const client = buildClient(insert.table);

    const result = await adminCreateSeoPagePreviewToken("page_1", {
      client,
      actorId: "admin_1",
      token: "preview-token",
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(result.previewPath).toBe("/resources/preview/preview-token");
    expect(result.row).toBe(inserted);
    const row = insert.mocks.insert.mock.calls[0]?.[0];
    expect(row.token_hash).not.toBe("preview-token");
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.token_prefix).toBe("preview-");
  });

  it("loads draft content by a valid preview token", async () => {
    const tokenLookup = maybeSingleByEq({
      id: "token_1",
      page_id: "page_1",
      expires_at: "2026-05-09T01:00:00.000Z",
      revoked_at: null,
    });
    const pageLookup = maybeSingleByEq({
      id: "page_1",
      slug: "preview-page",
      title: "Preview Page",
      status: "draft",
      target_keyword: "preview keyword",
      page_type: "resource",
      template_key: "standard",
      draft_content: validContent,
      draft_settings: {},
      published_content: null,
      published_revision_id: null,
      seo_title: "Preview Page",
      meta_description: "Draft preview page.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      og_asset_id: null,
      structured_data_settings: {},
      published_at: null,
      archived_at: null,
      archive_behavior: "not_found",
      archive_redirect_url: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-05-06T01:00:00.000Z",
      updated_at: "2026-05-06T01:00:00.000Z",
    });
    const client = buildClient(tokenLookup.table, pageLookup.table);

    const result = await getSeoPagePreviewByToken("preview-token", {
      client,
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(result?.published_content).toEqual(validContent);
    expect(result?.slug).toBe("preview-page");
  });

  it("loads draft settings by a valid preview token", async () => {
    const tokenLookup = maybeSingleByEq({
      id: "token_1",
      page_id: "page_1",
      expires_at: "2026-05-09T01:00:00.000Z",
      revoked_at: null,
    });
    const pageLookup = maybeSingleByEq({
      id: "page_1",
      slug: "live-page",
      title: "Live Page",
      status: "published",
      target_keyword: "live keyword",
      page_type: "resource",
      template_key: "standard",
      draft_content: validContent,
      draft_settings: {
        slug: "draft-page",
        title: "Draft Page",
        targetKeyword: "draft keyword",
        seoTitle: "Draft SEO",
        metaDescription: "Draft meta description.",
        canonicalUrl: "/resources/draft-page",
        noindex: true,
        sitemapEnabled: false,
      },
      published_content: { version: 1, sections: [] },
      published_revision_id: "revision_1",
      seo_title: "Live SEO",
      meta_description: "Live meta description.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      og_asset_id: null,
      structured_data_settings: {},
      published_at: "2026-05-06T01:00:00.000Z",
      archived_at: null,
      archive_behavior: "not_found",
      archive_redirect_url: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-05-06T01:00:00.000Z",
      updated_at: "2026-05-06T01:00:00.000Z",
    });
    const client = buildClient(tokenLookup.table, pageLookup.table);

    const result = await getSeoPagePreviewByToken("preview-token", {
      client,
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(result).toEqual(
      expect.objectContaining({
        slug: "draft-page",
        title: "Draft Page",
        target_keyword: "draft keyword",
        seo_title: "Draft SEO",
        meta_description: "Draft meta description.",
        canonical_url: "/resources/draft-page",
        noindex: true,
        sitemap_enabled: false,
        published_content: validContent,
      }),
    );
  });

  it("rejects revoked or expired preview tokens", async () => {
    const revokedLookup = maybeSingleByEq({
      id: "token_1",
      page_id: "page_1",
      expires_at: "2026-05-09T01:00:00.000Z",
      revoked_at: "2026-05-06T02:00:00.000Z",
    });
    const expiredLookup = maybeSingleByEq({
      id: "token_2",
      page_id: "page_1",
      expires_at: "2026-05-05T01:00:00.000Z",
      revoked_at: null,
    });

    await expect(
      getSeoPagePreviewByToken("revoked-token", {
        client: buildClient(revokedLookup.table),
      }),
    ).resolves.toBeNull();
    await expect(
      getSeoPagePreviewByToken("expired-token", {
        client: buildClient(expiredLookup.table),
        now: () => new Date("2026-05-06T01:00:00.000Z"),
      }),
    ).resolves.toBeNull();
  });

  it("checks active preview token existence without loading page drafts", async () => {
    const tokenLookup = maybeSingleByEq({
      id: "token_1",
      expires_at: "2026-05-09T01:00:00.000Z",
      revoked_at: null,
    });
    const client = buildClient(tokenLookup.table);

    await expect(
      hasActiveSeoPagePreviewToken("preview-token", {
        client,
        now: () => new Date("2026-05-06T01:00:00.000Z"),
      }),
    ).resolves.toBe(true);

    expect(client.from).toHaveBeenCalledTimes(1);
    expect(tokenLookup.mocks.select).toHaveBeenCalledWith(
      "id, expires_at, revoked_at",
    );
  });

  it("rolls a frozen revision back into draft without changing published content", async () => {
    const revision = {
      id: "revision_1",
      page_id: "page_1",
      revision_type: "publish",
      label: "Publish",
      content_snapshot: validContent,
      seo_snapshot: {
        title: "Rolled Back Title",
        seo_title: "Rolled Back SEO",
        meta_description: "Rolled back meta.",
        noindex: false,
        sitemap_enabled: true,
      },
      created_by: "admin_1",
      created_at: "2026-05-06T01:00:00.000Z",
    };
    const rollbackRevision = {
      id: "rollback_1",
      page_id: "page_1",
      revision_type: "rollback",
    };
    const page = {
      id: "page_1",
      draft_content: validContent,
      published_content: { version: 1, sections: [] },
    };
    const revisionLookup = maybeSingleByMatch(revision);
    const client = buildClient(revisionLookup.table);
    client.rpc.mockResolvedValueOnce({
      data: { page, revision: rollbackRevision },
      error: null,
    });

    const result = await adminRollbackSeoPageRevision("page_1", "revision_1", {
      client,
      actorId: "admin_1",
    });

    expect(result).toEqual({ page, revision: rollbackRevision });
    expect(client.rpc).toHaveBeenCalledWith(
      "apply_seo_page_revision_update_atomically",
      expect.objectContaining({
        p_page_id: "page_1",
        p_revision_type: "rollback",
        p_revision_label: "Restore draft from Publish",
        p_content_snapshot: validContent,
        p_seo_snapshot: revision.seo_snapshot,
        p_draft_content: validContent,
        p_seo_patch: expect.objectContaining({
          title: "Rolled Back Title",
          seo_title: "Rolled Back SEO",
          meta_description: "Rolled back meta.",
        }),
        p_actor_id: "admin_1",
      }),
    );
    expect(client.rpc.mock.calls[0]?.[1].p_seo_patch).not.toHaveProperty(
      "published_content",
    );
  });
});
