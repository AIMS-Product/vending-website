import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkCreateMediaAssets,
  bulkDeleteMediaAssets,
  createMediaAsset,
  createMediaAssetFromEditor,
  updateMediaAsset,
} from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  adminCreateMediaAsset: vi.fn(),
  adminUpdateMediaAsset: vi.fn(),
  adminBulkDeleteMediaAssets: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/services/media-assets", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/media-assets")
  >("@/lib/services/media-assets");
  return {
    ...actual,
    adminCreateMediaAsset: mocks.adminCreateMediaAsset,
    adminUpdateMediaAsset: mocks.adminUpdateMediaAsset,
    adminBulkDeleteMediaAssets: mocks.adminBulkDeleteMediaAssets,
  };
});

const ASSET_ID = "11111111-1111-4111-8111-111111111111";

function assetFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("assetType", "image");
  formData.set("title", "Hero shot");
  formData.set("altText", "A vending machine in a gym lobby");
  formData.set("sourceRightsNotes", "Shot in-house, owned outright.");
  formData.set("storageBucket", "page-builder-media");
  formData.set("storagePath", "images/hero.webp");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe("media server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
    mocks.adminCreateMediaAsset.mockResolvedValue({ id: ASSET_ID });
    mocks.adminUpdateMediaAsset.mockResolvedValue({ id: ASSET_ID });
  });

  describe("createMediaAsset", () => {
    it("refuses an image with neither an upload nor an external URL", async () => {
      // Without this the row is created pointing at nothing, and every surface
      // that renders it gets a broken image with no way back to a source.
      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData({ storageBucket: "", storagePath: "" }),
      );

      expect(result).toEqual({
        status: "error",
        message: "Upload an image or provide an external URL.",
      });
      expect(mocks.adminCreateMediaAsset).not.toHaveBeenCalled();
    });

    it("refuses an image with a storage bucket but no path", async () => {
      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData({ storagePath: "" }),
      );

      expect(result.status).toBe("error");
      expect(mocks.adminCreateMediaAsset).not.toHaveBeenCalled();
    });

    it("requires an external URL for video and embed assets", async () => {
      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData({
          assetType: "video",
          storageBucket: "",
          storagePath: "",
        }),
      );

      expect(result).toEqual({
        status: "error",
        message: "Video and embed assets require an external URL.",
      });
    });

    it("requires alt text on images, which storage alone does not supply", async () => {
      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData({ altText: "" }),
      );

      expect(result).toEqual({
        status: "error",
        message: "Alt text is required for image assets.",
      });
    });

    it("rejects a non-HTTP external URL", async () => {
      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData({
          storageBucket: "",
          storagePath: "",
          externalUrl: "javascript:alert(1)",
        }),
      );

      expect(result.status).toBe("error");
      expect(mocks.adminCreateMediaAsset).not.toHaveBeenCalled();
    });

    it("saves a valid image, deduplicating and lowercasing its tags", async () => {
      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData({ tags: "Hero, hero ,proof,", durationSeconds: "abc" }),
      );

      expect(result).toEqual({
        status: "saved",
        message: "Media asset saved.",
      });
      expect(mocks.adminCreateMediaAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          assetType: "image",
          tags: ["hero", "proof"],
          // Unparseable durations become null rather than NaN.
          durationSeconds: null,
          uploadedBy: "admin_1",
        }),
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/media");
    });

    it("reports the service's own message when the write fails", async () => {
      mocks.adminCreateMediaAsset.mockRejectedValue(
        new Error("Media asset image needs a storage path or external URL."),
      );
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createMediaAsset(
        { status: "idle" },
        assetFormData(),
      );

      expect(result).toEqual({
        status: "error",
        message: "Media asset image needs a storage path or external URL.",
      });
      error.mockRestore();
    });
  });

  describe("updateMediaAsset", () => {
    it("rejects an asset id that is not a uuid before touching the service", async () => {
      const formData = assetFormData();
      formData.set("assetId", "not-a-uuid");

      const result = await updateMediaAsset({ status: "idle" }, formData);

      expect(result.status).toBe("error");
      expect(mocks.adminUpdateMediaAsset).not.toHaveBeenCalled();
    });

    it("updates a valid asset", async () => {
      const formData = assetFormData({ tags: "proof" });
      formData.set("assetId", ASSET_ID);

      const result = await updateMediaAsset({ status: "idle" }, formData);

      expect(result).toEqual({
        status: "saved",
        message: "Media asset updated.",
      });
      expect(mocks.adminUpdateMediaAsset).toHaveBeenCalledWith(
        ASSET_ID,
        expect.objectContaining({ tags: ["proof"] }),
      );
    });
  });

  describe("bulkDeleteMediaAssets", () => {
    it("reports an error when everything selected was skipped as in use", async () => {
      // The dangerous shape: nothing was deleted, but the operation "succeeded".
      // Reported as saved, the admin reads "Deleted 0 assets" as done and moves
      // on believing the references are gone.
      mocks.adminBulkDeleteMediaAssets.mockResolvedValue({
        deleted: 0,
        skipped: 2,
        errors: [],
      });

      const result = await bulkDeleteMediaAssets([ASSET_ID, ASSET_ID]);

      expect(result).toEqual({
        status: "error",
        message: "Selected assets are still in use and were not deleted.",
      });
    });

    it("surfaces the service error when nothing was deleted and nothing was in use", async () => {
      mocks.adminBulkDeleteMediaAssets.mockResolvedValue({
        deleted: 0,
        skipped: 0,
        errors: ["Could not delete media asset."],
      });

      const result = await bulkDeleteMediaAssets([ASSET_ID]);

      expect(result.status).toBe("error");
      expect(result.message).toContain("Could not delete media asset.");
    });

    it("reports a partial delete as saved and still names what was skipped", async () => {
      mocks.adminBulkDeleteMediaAssets.mockResolvedValue({
        deleted: 2,
        skipped: 1,
        errors: [],
      });

      const result = await bulkDeleteMediaAssets([ASSET_ID]);

      expect(result.status).toBe("saved");
      expect(result.message).toBe("Deleted 2 assets. 1 in-use asset skipped.");
    });

    it("rejects a non-uuid selection before reaching the service", async () => {
      const result = await bulkDeleteMediaAssets(["not-a-uuid"]);

      expect(result.status).toBe("error");
      expect(mocks.adminBulkDeleteMediaAssets).not.toHaveBeenCalled();
    });
  });

  describe("bulkCreateMediaAssets", () => {
    function uploadItem(overrides: Record<string, string> = {}) {
      return {
        title: "Uploaded image",
        altText: "An uploaded image",
        storageBucket: "page-builder-media",
        storagePath: "images/upload.webp",
        ...overrides,
      };
    }

    it("refuses more than twenty at a time without creating any of them", async () => {
      const result = await bulkCreateMediaAssets(
        Array.from({ length: 21 }, () => uploadItem()),
      );

      expect(result).toEqual({
        status: "error",
        message: "Upload up to 20 images at a time.",
      });
      expect(mocks.adminCreateMediaAsset).not.toHaveBeenCalled();
    });

    it("accepts exactly twenty", async () => {
      const result = await bulkCreateMediaAssets(
        Array.from({ length: 20 }, () => uploadItem()),
      );

      expect(result.status).toBe("saved");
      expect(mocks.adminCreateMediaAsset).toHaveBeenCalledTimes(20);
    });

    it("refuses an empty selection", async () => {
      const result = await bulkCreateMediaAssets([]);

      expect(result).toEqual({
        status: "error",
        message: "Choose at least one image to upload.",
      });
    });

    it("saves the good items and counts the failures instead of failing the batch", async () => {
      // An upload of twenty files where one has a one-character name must not
      // discard the other nineteen — the files are already in storage.
      mocks.adminCreateMediaAsset
        .mockResolvedValueOnce({ id: ASSET_ID })
        .mockRejectedValueOnce(new Error("Storage path already exists."))
        .mockResolvedValueOnce({ id: ASSET_ID });

      const result = await bulkCreateMediaAssets([
        uploadItem(),
        uploadItem(),
        uploadItem(),
        uploadItem({ title: "x" }), // fails schema, never reaches the service
      ]);

      expect(result.status).toBe("saved");
      expect(result.message).toBe("Saved 2 images. 2 file(s) failed.");
      expect(mocks.adminCreateMediaAsset).toHaveBeenCalledTimes(3);
    });

    it("reports an error only when every item failed", async () => {
      mocks.adminCreateMediaAsset.mockRejectedValue(
        new Error("Storage path already exists."),
      );

      const result = await bulkCreateMediaAssets([uploadItem()]);

      expect(result).toEqual({
        status: "error",
        message: "Storage path already exists.",
      });
    });
  });

  describe("createMediaAssetFromEditor", () => {
    // Same rules as createMediaAsset, but this one throws instead of returning
    // an error state — the editor awaits it directly. The two copies of the
    // validation must not drift.
    it("throws on an image with neither an upload nor an external URL", async () => {
      await expect(
        createMediaAssetFromEditor(
          assetFormData({ storageBucket: "", storagePath: "" }),
        ),
      ).rejects.toThrow("Upload an image or provide an external URL.");
      expect(mocks.adminCreateMediaAsset).not.toHaveBeenCalled();
    });

    it("throws on a video without an external URL", async () => {
      await expect(
        createMediaAssetFromEditor(
          assetFormData({
            assetType: "video",
            storageBucket: "",
            storagePath: "",
          }),
        ),
      ).rejects.toThrow("Video and embed assets require an external URL.");
    });

    it("returns the created asset in editor shape", async () => {
      mocks.adminCreateMediaAsset.mockResolvedValue({
        id: ASSET_ID,
        asset_type: "image",
        title: "Hero shot",
        alt_text: "A vending machine in a gym lobby",
        caption: null,
        source_rights_notes: "Shot in-house, owned outright.",
        storage_bucket: "page-builder-media",
        storage_path: "images/hero.webp",
        external_url: null,
        thumbnail_asset_id: null,
        width: null,
        height: null,
        duration_seconds: null,
        tags: [],
        uploaded_by: "admin_1",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      });

      const asset = await createMediaAssetFromEditor(assetFormData());

      expect(asset).toEqual(expect.objectContaining({ id: ASSET_ID }));
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/media");
    });
  });

  it("requires an admin before every one of these mutations", async () => {
    // Server actions are public HTTP endpoints. An unauthenticated caller must
    // not reach the service layer through any of them.
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      createMediaAsset({ status: "idle" }, assetFormData()),
    ).rejects.toThrow("Unauthorized");
    await expect(
      updateMediaAsset({ status: "idle" }, assetFormData()),
    ).rejects.toThrow("Unauthorized");
    await expect(bulkDeleteMediaAssets([ASSET_ID])).rejects.toThrow(
      "Unauthorized",
    );
    await expect(bulkCreateMediaAssets([])).rejects.toThrow("Unauthorized");

    expect(mocks.adminCreateMediaAsset).not.toHaveBeenCalled();
    expect(mocks.adminUpdateMediaAsset).not.toHaveBeenCalled();
    expect(mocks.adminBulkDeleteMediaAssets).not.toHaveBeenCalled();
  });
});
