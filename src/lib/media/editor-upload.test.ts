import { describe, expect, it, vi } from "vitest";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import {
  defaultEditorImageFields,
  isAcceptedEditorImageFile,
  mediaAltFromFilename,
  mediaTitleFromFilename,
  uploadImageFileToMediaLibrary,
  uploadImageFileToStorage,
} from "./editor-upload";

describe("editor upload helpers", () => {
  it("builds readable titles from filenames", () => {
    expect(mediaTitleFromFilename("hero-banner.webp")).toBe("Hero banner");
    expect(mediaAltFromFilename("split-hero.jpg")).toBe("Split hero");
  });

  it("accepts supported image mime types and extensions", () => {
    expect(
      isAcceptedEditorImageFile({
        name: "photo.png",
        type: "image/png",
      } as File),
    ).toBe(true);
    expect(
      isAcceptedEditorImageFile({
        name: "photo.gif",
        type: "image/gif",
      } as File),
    ).toBe(false);
  });

  it("builds default image metadata from filenames", () => {
    expect(
      defaultEditorImageFields({
        name: "install-photo.png",
        type: "image/png",
      } as File),
    ).toMatchObject({
      title: "Install photo",
      altText: "Install photo",
    });
  });

  it("uploads accepted images through a signed storage URL", async () => {
    const file = { name: "hero-banner.webp", type: "image/webp" } as File;
    const signedUpload = {
      bucket: "page-builder-media",
      path: "images/test-hero-banner.webp",
      token: "signed-token",
      signedUrl: "https://example.test/signed",
      publicUrl: "https://example.test/public",
    };
    const createSignedUpload = vi.fn().mockResolvedValue(signedUpload);
    const uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ uploadToSignedUrl });

    await expect(
      uploadImageFileToStorage(file, {
        createSignedUpload,
        createStorageClient: () => ({ storage: { from } }),
      }),
    ).resolves.toEqual({
      storageBucket: signedUpload.bucket,
      storagePath: signedUpload.path,
    });

    const request = createSignedUpload.mock.calls[0]?.[0] as FormData;
    expect(request.get("filename")).toBe(file.name);
    expect(from).toHaveBeenCalledWith(signedUpload.bucket);
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      signedUpload.path,
      signedUpload.token,
      file,
      {
        contentType: "image/webp",
        upsert: false,
      },
    );
  });

  it("rejects unsupported images before creating a signed upload", async () => {
    const createSignedUpload = vi.fn();
    const uploadToSignedUrl = vi.fn();

    await expect(
      uploadImageFileToStorage(
        { name: "animation.gif", type: "image/gif" } as File,
        {
          createSignedUpload,
          createStorageClient: () => ({
            storage: { from: () => ({ uploadToSignedUrl }) },
          }),
        },
      ),
    ).rejects.toThrow("Use an AVIF, WebP, PNG, or JPEG image.");

    expect(createSignedUpload).not.toHaveBeenCalled();
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
  });

  it("surfaces storage upload failures", async () => {
    const uploadError = new Error("storage denied");
    const uploadToSignedUrl = vi.fn().mockResolvedValue({ error: uploadError });

    await expect(
      uploadImageFileToStorage(
        { name: "hero.png", type: "image/png" } as File,
        {
          createSignedUpload: vi.fn().mockResolvedValue({
            bucket: "page-builder-media",
            path: "images/hero.png",
            token: "signed-token",
            signedUrl: "https://example.test/signed",
            publicUrl: "https://example.test/public",
          }),
          createStorageClient: () => ({
            storage: { from: () => ({ uploadToSignedUrl }) },
          }),
        },
      ),
    ).rejects.toThrow(uploadError);
  });

  it("creates a media library asset after the shared storage upload", async () => {
    const file = { name: "service-area.jpg", type: "" } as File;
    const uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null });
    const createdAsset = {
      id: "asset-1",
      assetType: "image",
      title: "Service area",
      altText: "Service area",
      publicUrl: "https://example.test/images/service-area.jpg",
    } as EditorMediaAsset;
    const createMediaAsset = vi.fn().mockResolvedValue(createdAsset);

    await expect(
      uploadImageFileToMediaLibrary(file, {
        createSignedUpload: vi.fn().mockResolvedValue({
          bucket: "page-builder-media",
          path: "images/service-area.jpg",
          token: "signed-token",
          signedUrl: "https://example.test/signed",
          publicUrl: createdAsset.publicUrl,
        }),
        createStorageClient: () => ({
          storage: { from: () => ({ uploadToSignedUrl }) },
        }),
        createMediaAsset,
      }),
    ).resolves.toBe(createdAsset);

    const formData = createMediaAsset.mock.calls[0]?.[0] as FormData;
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      "images/service-area.jpg",
      "signed-token",
      file,
      {
        contentType: "image/jpeg",
        upsert: false,
      },
    );
    expect(formData.get("assetType")).toBe("image");
    expect(formData.get("title")).toBe("Service area");
    expect(formData.get("altText")).toBe("Service area");
    expect(formData.get("storageBucket")).toBe("page-builder-media");
    expect(formData.get("storagePath")).toBe("images/service-area.jpg");
  });
});
