import { describe, expect, it } from "vitest";
import { blockPickerOptions } from "@/lib/page-builder/block-options";
import {
  blockCanvasPlaceholders,
  blockEditorPlaceholders,
  richTextBodyPlaceholder,
} from "@/lib/page-builder/block-editor-placeholders";
import type { PageBlock } from "@/lib/page-builder/blocks";

const blockTypes = blockPickerOptions.map((option) => option.type);

describe("block editor placeholders", () => {
  it("defines canvas placeholders for every picker block type", () => {
    expect(Object.keys(blockCanvasPlaceholders).sort()).toEqual(
      [...blockTypes].sort(),
    );
  });

  it("uses checklist-specific body guidance", () => {
    expect(richTextBodyPlaceholder("checklist")).toBe(
      blockEditorPlaceholders.checklistBody,
    );
    expect(richTextBodyPlaceholder("default")).toBe(
      blockEditorPlaceholders.richTextBody,
    );
  });

  it("keeps placeholder copy user-facing rather than schema-oriented", () => {
    for (const value of Object.values(blockEditorPlaceholders)) {
      expect(value.toLowerCase()).not.toContain("schema");
      expect(value.toLowerCase()).not.toContain("uuid");
    }
  });

  it("covers core editable fields for each block type", () => {
    const requiredKeys: Record<PageBlock["type"], string[]> = {
      hero: ["eyebrow", "heading", "body", "ctaLabel"],
      rich_text: ["eyebrow", "heading", "body"],
      image: ["caption"],
      video: ["title", "caption"],
      cta: ["label"],
      faq: ["heading", "question", "answer"],
      card_grid: ["heading", "title", "body"],
      proof: ["eyebrow", "body", "name", "context"],
      lead_form: ["heading", "body", "submitLabel"],
    };

    for (const type of blockTypes) {
      for (const key of requiredKeys[type]) {
        expect(blockCanvasPlaceholders[type]).toHaveProperty(key);
        expect(
          blockCanvasPlaceholders[type][
            key as keyof (typeof blockCanvasPlaceholders)[typeof type]
          ],
        ).toBeTruthy();
      }
    }
  });
});
