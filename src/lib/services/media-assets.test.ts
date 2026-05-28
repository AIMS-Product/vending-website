import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminBuildMediaUsageIndex,
  adminBulkAddTagsToAssets,
  adminCreateMediaAsset,
  adminDeleteMediaAsset,
  adminGetMediaAssetUsage,
  adminListMediaAssets,
  adminUpdateMediaAsset,
  publicMediaAssetUrl,
  validateMediaAssetReferences,
} from "./media-assets";
import type { Database } from "@/types/database";

type MediaClient = Pick<SupabaseClient<Database>, "from">;

function plainSelect(data: unknown, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data, error });
  return { table: { select }, mocks: { select } };
}

function listSelect(data: unknown, error: unknown = null) {
  const resolveWith = { data, error };
  const builder = {
    or: vi.fn().mockReturnThis(),
    then(
      onFulfilled: (value: typeof resolveWith) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    },
  };
  const order = vi.fn().mockReturnValue(builder);
  const inFn = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ in: inFn });
  return {
    table: { select },
    mocks: { select, in: inFn, order, or: builder.or },
  };
}

function eqSelect(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq } };
}

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
}

function updateSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  return { table: { update }, mocks: { update, eq, select, single } };
}

function maybeSingleSelect(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, maybeSingle } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
  } as unknown as MediaClient & { from: ReturnType<typeof vi.fn> };
}

describe("media asset service", () => {
  it("lists assets with type filter and title search", async () => {
    const list = listSelect([{ id: "asset_1", title: "Hero" }]);
    const client = buildClient(list.table);

    await expect(
      adminListMediaAssets(
        { search: "Hero", assetTypes: ["image"] },
        { client },
      ),
    ).resolves.toEqual([{ id: "asset_1", title: "Hero" }]);

    expect(client.from).toHaveBeenCalledWith("media_assets");
    expect(list.mocks.in).toHaveBeenCalledWith("asset_type", ["image"]);
    expect(list.mocks.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(list.mocks.or).toHaveBeenCalledWith(
      "title.ilike.%Hero%,tags.cs.{Hero}",
    );
  });

  it("creates image media assets only with source, alt, and rights metadata", async () => {
    const created = { id: "asset_1", title: "Hero" };
    const insert = insertSingle(created);
    const client = buildClient(insert.table);

    await expect(
      adminCreateMediaAsset(
        {
          title: "Hero",
          altText: "Operator beside vending machine",
          sourceRightsNotes: "Owned campaign image.",
          storageBucket: "page-builder-media",
          storagePath: "images/hero.webp",
          tags: ["hero"],
          uploadedBy: "admin_1",
        },
        { client },
      ),
    ).resolves.toBe(created);

    expect(insert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_type: "image",
        title: "Hero",
        alt_text: "Operator beside vending machine",
        source_rights_notes: "Owned campaign image.",
        storage_bucket: "page-builder-media",
        storage_path: "images/hero.webp",
        tags: ["hero"],
      }),
    );

    await expect(
      adminCreateMediaAsset(
        {
          title: "Bad",
          altText: "",
          sourceRightsNotes: "",
          storagePath: null,
          externalUrl: null,
        },
        { client },
      ),
    ).rejects.toThrow("Alt text is required.");
  });

  it("creates video assets with external URLs only", async () => {
    const created = { id: "video_1", title: "Walkthrough" };
    const insert = insertSingle(created);
    const client = buildClient(insert.table);

    await expect(
      adminCreateMediaAsset(
        {
          assetType: "video",
          title: "Walkthrough",
          altText: "",
          sourceRightsNotes: "Licensed YouTube embed.",
          externalUrl: "https://www.youtube.com/watch?v=abc123",
        },
        { client },
      ),
    ).resolves.toBe(created);

    expect(insert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_type: "video",
        external_url: "https://www.youtube.com/watch?v=abc123",
      }),
    );
  });

  it("updates editable media metadata", async () => {
    const existing = {
      id: "asset_1",
      asset_type: "image",
      title: "Hero",
      alt_text: "Hero",
      caption: null,
      source_rights_notes: "Owned.",
      storage_bucket: "page-builder-media",
      storage_path: "images/hero.webp",
      external_url: null,
      thumbnail_asset_id: null,
      width: null,
      height: null,
      duration_seconds: null,
      tags: [],
      uploaded_by: null,
      created_at: "2026-05-06T00:00:00Z",
      updated_at: "2026-05-06T00:00:00Z",
    };
    const load = maybeSingleSelect(existing);
    const update = updateSingle({ ...existing, title: "Updated hero" });
    const client = buildClient(load.table, update.table);

    await expect(
      adminUpdateMediaAsset(
        "asset_1",
        {
          title: "Updated hero",
          sourceRightsNotes: "Owned.",
          altText: "Hero",
        },
        { client },
      ),
    ).resolves.toEqual(expect.objectContaining({ title: "Updated hero" }));
  });

  it("blocks delete when usage exists", async () => {
    const asset = {
      id: "asset_1",
      asset_type: "image",
      title: "Hero",
      alt_text: "Hero",
      caption: null,
      source_rights_notes: "Owned.",
      storage_bucket: "page-builder-media",
      storage_path: "images/hero.webp",
      external_url: null,
      thumbnail_asset_id: null,
      width: null,
      height: null,
      duration_seconds: null,
      tags: [],
      uploaded_by: null,
      created_at: "2026-05-06T00:00:00Z",
      updated_at: "2026-05-06T00:00:00Z",
    };
    const load = maybeSingleSelect(asset);
    const seoPages = listSelect([]);
    const newsPosts = listSelect([]);
    const proofItems = eqSelect([{ id: "proof_1", body: "Great service." }]);
    const sourceDocuments = eqSelect([]);
    const client = buildClient(
      load.table,
      seoPages.table,
      newsPosts.table,
      proofItems.table,
      sourceDocuments.table,
    );

    await expect(
      adminGetMediaAssetUsage("asset_1", { client }),
    ).resolves.toEqual(expect.objectContaining({ totalCount: 1 }));

    const usageLoad = maybeSingleSelect(asset);
    const usageSeo = listSelect([]);
    const usageNews = listSelect([]);
    const usageProof = eqSelect([{ id: "proof_1", body: "Great service." }]);
    const usageSource = eqSelect([]);
    const deleteClient = buildClient(
      usageLoad.table,
      usageSeo.table,
      usageNews.table,
      usageProof.table,
      usageSource.table,
    );

    await expect(
      adminDeleteMediaAsset("asset_1", { client: deleteClient }),
    ).rejects.toThrow("still referenced elsewhere");
  });

  it("validates referenced asset types per block", () => {
    const issues = validateMediaAssetReferences(
      [
        {
          assetId: "asset_1",
          expectedTypes: ["video", "embed"],
          path: "blocks.0.props.assetId",
        },
      ],
      new Map([
        [
          "asset_1",
          {
            id: "asset_1",
            asset_type: "image",
            title: "Hero",
            alt_text: "Hero",
            caption: null,
            source_rights_notes: "Owned.",
            storage_bucket: "page-builder-media",
            storage_path: "images/hero.webp",
            external_url: null,
            thumbnail_asset_id: null,
            width: null,
            height: null,
            duration_seconds: null,
            tags: [],
            uploaded_by: null,
            created_at: "2026-05-06T00:00:00Z",
            updated_at: "2026-05-06T00:00:00Z",
          },
        ],
      ]),
    );

    expect(issues).toEqual([
      expect.objectContaining({ code: "invalid_media_asset_type" }),
    ]);
  });

  it("builds a usage index across seo pages, news, proof, and source docs", async () => {
    const mediaAssets = [
      {
        id: "asset_1",
        asset_type: "image",
        title: "Hero",
        alt_text: "Hero",
        caption: null,
        source_rights_notes: "Owned.",
        storage_bucket: "page-builder-media",
        storage_path: "images/hero.webp",
        external_url: null,
        thumbnail_asset_id: null,
        width: null,
        height: null,
        duration_seconds: null,
        tags: [],
        uploaded_by: null,
        created_at: "2026-05-06T00:00:00Z",
        updated_at: "2026-05-06T00:00:00Z",
      },
    ];
    const mediaList = plainSelect(mediaAssets);
    const seoPages = plainSelect([
      {
        id: "page_1",
        og_asset_id: "asset_1",
        draft_content: null,
        published_content: null,
      },
    ]);
    const newsPosts = plainSelect([]);
    const proofItems = plainSelect([]);
    const sourceDocuments = plainSelect([]);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "media_assets") return mediaList.table;
        if (table === "seo_pages") return seoPages.table;
        if (table === "news_posts") return newsPosts.table;
        if (table === "proof_items") return proofItems.table;
        if (table === "source_documents") return sourceDocuments.table;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as MediaClient & { from: ReturnType<typeof vi.fn> };

    await expect(adminBuildMediaUsageIndex({ client })).resolves.toEqual({
      asset_1: 1,
    });
  });

  it("adds tags in bulk without duplicating existing tags", async () => {
    const existing = {
      id: "asset_1",
      asset_type: "image",
      title: "Hero",
      alt_text: "Hero",
      caption: null,
      source_rights_notes: "Owned.",
      storage_bucket: "page-builder-media",
      storage_path: "images/hero.webp",
      external_url: null,
      thumbnail_asset_id: null,
      width: null,
      height: null,
      duration_seconds: null,
      tags: ["hero"],
      uploaded_by: null,
      created_at: "2026-05-06T00:00:00Z",
      updated_at: "2026-05-06T00:00:00Z",
    };
    const load = maybeSingleSelect(existing);
    const update = updateSingle({ ...existing, tags: ["hero", "proof"] });
    const client = buildClient(load.table, load.table, update.table);

    await expect(
      adminBulkAddTagsToAssets(["asset_1"], "proof", { client }),
    ).resolves.toEqual({ updated: 1, tag: "proof" });
  });

  it("builds public URLs for stored media assets", () => {
    expect(
      publicMediaAssetUrl({
        id: "asset_1",
        asset_type: "image",
        title: "Hero",
        alt_text: "Hero",
        caption: null,
        source_rights_notes: "Owned.",
        storage_bucket: "page-builder-media",
        storage_path: "images/hero.webp",
        external_url: null,
        thumbnail_asset_id: null,
        width: null,
        height: null,
        duration_seconds: null,
        tags: [],
        uploaded_by: null,
        created_at: "2026-05-06T00:00:00Z",
        updated_at: "2026-05-06T00:00:00Z",
      }),
    ).toContain(
      "/storage/v1/object/public/page-builder-media/images/hero.webp",
    );
  });
});
