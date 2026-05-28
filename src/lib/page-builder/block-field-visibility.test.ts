import { describe, expect, it } from "vitest";
import type { PageBlock } from "@/lib/page-builder/blocks";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import {
  defaultFieldVisibility,
  isBlockFieldVisible,
  setBlockFieldVisibility,
  withDefaultFieldVisibility,
} from "@/lib/page-builder/block-field-visibility";

describe("block field visibility", () => {
  it("defaults compact rich text to body-only field visibility", () => {
    const block = withDefaultFieldVisibility({
      ...createPageBlock("rich_text", "block_1"),
      variant: "compact",
    } as Extract<PageBlock, { type: "rich_text" }>);

    expect(isBlockFieldVisible(block, "eyebrow")).toBe(false);
    expect(isBlockFieldVisible(block, "heading")).toBe(false);
  });

  it("persists explicit visibility toggles", () => {
    const block = withDefaultFieldVisibility(
      createPageBlock("rich_text", "block_1"),
    );
    const hiddenHeading = setBlockFieldVisibility(block, "heading", false);

    expect(isBlockFieldVisible(hiddenHeading, "heading")).toBe(false);

    const shownHeading = setBlockFieldVisibility(
      hiddenHeading,
      "heading",
      true,
    );
    expect(isBlockFieldVisible(shownHeading, "heading")).toBe(true);
  });

  it("infers legacy eyebrow visibility from stored copy", () => {
    const base = createPageBlock("rich_text", "block_1") as Extract<
      PageBlock,
      { type: "rich_text" }
    >;
    const block: Extract<PageBlock, { type: "rich_text" }> = {
      ...base,
      props: {
        ...base.props,
        eyebrow: "Plan",
      },
    };

    expect(isBlockFieldVisible(block, "eyebrow")).toBe(true);
    expect(defaultFieldVisibility(block).heading).toBe(true);
  });

  it("treats split hero media captions as optional", () => {
    const block = withDefaultFieldVisibility({
      ...(createPageBlock("hero", "block_1") as Extract<
        PageBlock,
        { type: "hero" }
      >),
      variant: "split",
    });

    expect(defaultFieldVisibility(block).mediaCaption).toBe(false);
    expect(isBlockFieldVisible(block, "mediaCaption")).toBe(false);
  });
});
