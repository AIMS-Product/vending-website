import { describe, expect, it } from "vitest";
import { blockPickerOptions } from "@/lib/page-builder/block-options";
import { blockCanvasPlaceholders } from "@/lib/page-builder/block-editor-placeholders";
import {
  defaultFieldVisibility,
  optionalFieldsForBlock,
} from "@/lib/page-builder/block-field-visibility";
import {
  blockRegistry,
  pageBlockSchema,
  type PageBlock,
} from "@/lib/page-builder/blocks";
import {
  blockPreviewCases,
  getBlockPreviewParityMarkers,
} from "@/lib/page-builder/block-preview-cases";
import { createPageBlock } from "@/lib/page-builder/content-ops";

describe("CTA block metadata", () => {
  it("drives CTA picker, registry, editor, and visibility metadata", () => {
    const pickerOption = blockPickerOptions.find(
      (option) => option.type === "cta",
    );
    const variants = [
      {
        id: "primary",
        label: "Primary CTA",
        description: "Main conversion action.",
      },
      {
        id: "secondary",
        label: "Secondary CTA",
        description: "Lower-emphasis conversion action.",
      },
      {
        id: "text",
        label: "Text link CTA",
        description: "Inline supporting action.",
      },
    ];

    expect(pickerOption).toEqual({
      type: "cta",
      label: "CTA",
      description: "Primary conversion button.",
      variants,
    });
    expect(blockRegistry.cta.allowedVariants).toEqual(
      variants.map((variant) => variant.id),
    );
    expect(blockRegistry.cta.defaultProps).toEqual({
      presetId: undefined,
      label: "",
      href: "/apply",
      trackingName: "",
    });
    expect(blockCanvasPlaceholders.cta).toEqual({ label: "CTA label" });
  });

  it("creates CTA defaults through the shared content operation", () => {
    const block = {
      id: "block_cta",
      type: "cta",
      variant: "primary",
      props: {
        presetId: undefined,
        label: "",
        href: "/apply",
        trackingName: "",
      },
    } satisfies Extract<PageBlock, { type: "cta" }>;

    expect(block).toEqual(createPageBlock("cta", "block_cta"));
    expect(optionalFieldsForBlock(block)).toEqual([]);
    expect(defaultFieldVisibility(block)).toEqual({});
  });

  it("creates renderable CTA preview data and parity markers", () => {
    const block = blockPreviewCases.find(
      (entry) => entry.type === "cta" && entry.variant === "text",
    )?.block;
    if (!block) throw new Error("Missing CTA text preview case.");
    const parsed = pageBlockSchema.parse(block) as Extract<
      PageBlock,
      { type: "cta" }
    >;

    expect(parsed).toEqual(block);
    expect(getBlockPreviewParityMarkers(block)).toEqual([
      {
        kind: "text",
        label: "label",
        value: "Read the application guide",
      },
    ]);
  });
});
