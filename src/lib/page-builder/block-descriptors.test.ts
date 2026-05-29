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
import { getBlockPreviewParityMarkers } from "@/lib/page-builder/block-preview-cases";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import {
  createDescriptorPageBlock,
  createDescriptorPreviewBlock,
  ctaBlockDescriptor,
} from "@/lib/page-builder/block-descriptors";

describe("page builder block descriptors", () => {
  it("drives CTA picker, registry, editor, and visibility metadata", () => {
    const pickerOption = blockPickerOptions.find(
      (option) => option.type === ctaBlockDescriptor.type,
    );

    expect(pickerOption).toEqual({
      type: ctaBlockDescriptor.type,
      label: ctaBlockDescriptor.label,
      description: ctaBlockDescriptor.description,
      variants: ctaBlockDescriptor.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        description: variant.description,
      })),
    });
    expect(blockRegistry.cta.allowedVariants).toEqual(
      ctaBlockDescriptor.variants.map((variant) => variant.id),
    );
    expect(blockRegistry.cta.defaultProps).toEqual(
      ctaBlockDescriptor.defaultProps,
    );
    expect(blockCanvasPlaceholders.cta).toEqual(
      ctaBlockDescriptor.editor.canvasPlaceholders,
    );
  });

  it("creates CTA defaults through the descriptor path", () => {
    const block = ctaBlockDescriptor.createBlock("block_cta");

    expect(block).toEqual(createPageBlock("cta", "block_cta"));
    expect(createDescriptorPageBlock("cta", "block_cta")).toEqual(block);
    expect(optionalFieldsForBlock(block)).toEqual(
      ctaBlockDescriptor.optionalFields,
    );
    expect(defaultFieldVisibility(block)).toEqual(
      ctaBlockDescriptor.defaultFieldVisibility,
    );
  });

  it("creates renderable CTA preview data and parity markers", () => {
    const block = ctaBlockDescriptor.createPreviewBlock(
      "block_cta_text",
      "text",
    );
    const descriptorBlock = createDescriptorPreviewBlock(
      "cta",
      "block_cta_text",
      "text",
    );
    const parsed = pageBlockSchema.parse(block) as Extract<
      PageBlock,
      { type: "cta" }
    >;

    expect(descriptorBlock).toEqual(block);
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
