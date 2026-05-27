import { describe, expect, it } from "vitest";
import { createEmptyPageContent } from "@/lib/page-builder/blocks";
import { ensureEditablePageContent } from "@/lib/page-builder/content-ops";
import {
  collectMediaAssetIds,
  collectMediaAssetReferences,
} from "@/lib/media/referenced-assets";

describe("referenced media assets", () => {
  it("collects image, hero, and video asset references", () => {
    const content = ensureEditablePageContent(createEmptyPageContent());
    content.sections[0].columns[0].blocks = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        type: "image",
        variant: "standard",
        props: {
          assetId: "22222222-2222-4222-8222-222222222222",
          src: "",
          altText: "",
          caption: "",
          sourceRightsNotes: "",
        },
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "hero",
        variant: "split",
        props: {
          eyebrow: "",
          heading: "Hero",
          body: "",
          ctaLabel: "",
          ctaHref: "",
          ctaTrackingName: "",
          mediaAssetId: "44444444-4444-4444-8444-444444444444",
          mediaSrc: "",
          mediaAltText: "Split hero",
          mediaCaption: "",
          proofText: "",
        },
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        type: "video",
        variant: "standard",
        props: {
          assetId: "66666666-6666-4666-8666-666666666666",
          title: "",
          url: "",
          caption: "",
        },
      },
    ];

    expect(collectMediaAssetIds(content)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "44444444-4444-4444-8444-444444444444",
      "66666666-6666-4666-8666-666666666666",
    ]);
    expect(collectMediaAssetReferences(content)).toEqual([
      expect.objectContaining({
        assetId: "22222222-2222-4222-8222-222222222222",
        expectedTypes: ["image"],
      }),
      expect.objectContaining({
        assetId: "44444444-4444-4444-8444-444444444444",
        expectedTypes: ["image"],
      }),
      expect.objectContaining({
        assetId: "66666666-6666-4666-8666-666666666666",
        expectedTypes: ["video", "embed"],
      }),
    ]);
  });
});
