import { describe, expect, it } from "vitest";
import { pageContentSchema } from "@/lib/page-builder/blocks";
import { blockPickerOptions } from "@/lib/page-builder/block-options";
import {
  blockPreviewCases,
  getBlockPreviewParityMarkers,
} from "@/lib/page-builder/block-preview-cases";

describe("page builder block preview cases", () => {
  it("covers every block picker variant exactly once", () => {
    const expected = blockPickerOptions.flatMap((option) =>
      option.variants.map((variant) => `${option.type}:${variant.id}`),
    );
    const actual = blockPreviewCases.map(
      (entry) => `${entry.type}:${entry.variant}`,
    );

    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(actual.length);
  });

  it("keeps every mocked preview renderable by the page content schema", () => {
    for (const entry of blockPreviewCases) {
      expect(() => pageContentSchema.parse(entry.content)).not.toThrow();
    }
  });

  it("defines at least one parity marker for every preview case", () => {
    for (const entry of blockPreviewCases) {
      const markers = getBlockPreviewParityMarkers(entry.block);
      expect(markers.length).toBeGreaterThan(0);
    }
  });
});
