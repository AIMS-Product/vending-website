import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImageStoragePath,
  createSignedImageStorageUpload,
} from "@/lib/supabase/signed-upload";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

beforeEach(() => {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "11111111-1111-4111-8111-111111111111",
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signed storage uploads", () => {
  it("builds safe image storage paths with supported extensions", () => {
    expect(
      createImageStoragePath({
        directory: "/covers/",
        filename: "Hero Banner.PNG",
        fallbackBase: "cover",
      }),
    ).toBe("covers/11111111-1111-4111-8111-111111111111-hero-banner.png");
  });

  it("falls back to jpg and the requested base for unsafe filenames", () => {
    expect(
      createImageStoragePath({
        directory: "images",
        filename: "!!!",
        fallbackBase: "image",
      }),
    ).toBe("images/11111111-1111-4111-8111-111111111111-image.jpg");
  });

  it("creates a signed upload URL in the requested bucket", async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: {
        token: "upload-token",
        signedUrl: "https://example.test/signed",
      },
      error: null,
    });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.test/public" },
    });
    const from = vi.fn().mockReturnValue({
      createSignedUploadUrl,
      getPublicUrl,
    });
    mocks.createAdminClient.mockReturnValue({ storage: { from } });

    await expect(
      createSignedImageStorageUpload({
        bucket: "page-builder-media",
        directory: "images",
        filename: "Machine Photo.webp",
        fallbackBase: "image",
      }),
    ).resolves.toEqual({
      bucket: "page-builder-media",
      path: "images/11111111-1111-4111-8111-111111111111-machine-photo.webp",
      token: "upload-token",
      signedUrl: "https://example.test/signed",
      publicUrl: "https://example.test/public",
    });

    expect(from).toHaveBeenCalledWith("page-builder-media");
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      "images/11111111-1111-4111-8111-111111111111-machine-photo.webp",
    );
    expect(getPublicUrl).toHaveBeenCalledWith(
      "images/11111111-1111-4111-8111-111111111111-machine-photo.webp",
    );
  });

  it("surfaces Supabase signed upload errors to the action layer", async () => {
    const error = new Error("storage denied");
    const from = vi.fn().mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: null,
        error,
      }),
    });
    mocks.createAdminClient.mockReturnValue({ storage: { from } });

    await expect(
      createSignedImageStorageUpload({
        bucket: "news-images",
        directory: "covers",
        filename: "cover.png",
        fallbackBase: "cover",
      }),
    ).rejects.toThrow(error);
  });
});
