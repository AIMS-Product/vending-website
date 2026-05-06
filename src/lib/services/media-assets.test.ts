import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminCreateMediaAsset,
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "./media-assets";
import type { Database } from "@/types/database";

type MediaClient = Pick<SupabaseClient<Database>, "from">;

function listSelect(data: unknown, error: unknown = null) {
  const ilike = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn().mockReturnValue({ ilike });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, order, ilike } };
}

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
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
  it("lists image assets with title search", async () => {
    const list = listSelect([{ id: "asset_1", title: "Hero" }]);
    const client = buildClient(list.table);

    await expect(
      adminListMediaAssets({ search: "Hero" }, { client }),
    ).resolves.toEqual([{ id: "asset_1", title: "Hero" }]);

    expect(client.from).toHaveBeenCalledWith("media_assets");
    expect(list.mocks.eq).toHaveBeenCalledWith("asset_type", "image");
    expect(list.mocks.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(list.mocks.ilike).toHaveBeenCalledWith("title", "%Hero%");
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
