import { describe, expect, it } from "vitest";
import {
  isAcceptedEditorImageFile,
  mediaAltFromFilename,
  mediaTitleFromFilename,
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
});
