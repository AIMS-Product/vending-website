import { describe, expect, it } from "vitest";
import { pageContentSchema } from "@/lib/page-builder/blocks";
import {
  getPageTemplate,
  pageTypeOptions,
  templateOptionsForPageType,
} from "@/lib/page-builder/page-templates";

describe("page templates", () => {
  it("defines marketer-facing page type choices with validated template content", () => {
    expect(pageTypeOptions.map((option) => option.id)).toEqual([
      "resource",
      "blog",
      "landing",
      "video",
    ]);

    for (const pageType of pageTypeOptions) {
      const templates = templateOptionsForPageType(pageType.id);
      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates[0]?.id).toBe("blank");

      for (const template of templates) {
        const resolved = getPageTemplate(pageType.id, template.id);
        expect(resolved.pageType).toBe(pageType.id);
        expect(resolved.templateKey).toBe(template.id);
        expect(() => pageContentSchema.parse(resolved.content)).not.toThrow();
      }
    }
  });

  it("rejects unknown page types or templates", () => {
    expect(() => getPageTemplate("invalid", "blank")).toThrow(
      "Unknown page type.",
    );
    expect(() => getPageTemplate("resource", "invalid")).toThrow(
      "Unknown page template.",
    );
  });
});
