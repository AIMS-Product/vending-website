import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PageBlock } from "@/lib/page-builder/blocks";
import { BlockSidebarSettingsPanel } from "./BlockSettingsFields";
import { PageChromeControls } from "./SeoPageEditorShell";

vi.mock("@/components/admin/MediaPickerProvider", () => ({
  MediaLibrarySelectButton({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) {
    return (
      <button type="button" onClick={onClick}>
        {label}
      </button>
    );
  },
  useMediaPicker() {
    return { assets: [], openMediaPicker: vi.fn() };
  },
}));

describe("qualification attachment settings UI", () => {
  it("renders page-level qualification defaults with chrome settings", () => {
    const html = renderToStaticMarkup(
      <PageChromeControls
        settings={{ showHeader: true, showFooter: true }}
        onChange={() => undefined}
        qualificationSettings={{
          formId: "11111111-1111-4111-8111-111111111111",
          completionRedirectPath: "/qualification-thanks",
          experimentKey: "post_submit_qualification",
          variantKey: "page_default",
        }}
        onQualificationChange={() => undefined}
      />,
    );

    expect(html).toContain("Qualification follow-up");
    expect(html).toContain("Default form");
    expect(html).toContain("Completion redirect");
    expect(html).toContain("Experiment key");
    expect(html).toContain("Variant key");
  });

  it("renders lead-form qualification overrides in block settings", () => {
    const block: Extract<PageBlock, { type: "lead_form" }> = {
      id: "block_form",
      type: "lead_form",
      variant: "standard",
      props: {
        heading: "Apply",
        body: "Start with your contact details.",
        submitLabel: "Continue",
        trackingName: "resource_lead_form",
        calendlyUrl: "",
        qualification: {
          formId: "22222222-2222-4222-8222-222222222222",
          completionRedirectPath: "/book-a-call",
          experimentKey: "post_submit_qualification",
          variantKey: "block_override",
        },
      },
    };

    const html = renderToStaticMarkup(
      <BlockSidebarSettingsPanel block={block} onChange={() => undefined} />,
    );

    expect(html).toContain("Qualification follow-up");
    expect(html).toContain("Form override");
    expect(html).toContain("Completion redirect");
    expect(html).toContain("Experiment key");
    expect(html).toContain("Variant key");
    expect(html).not.toContain("Layout");
  });
});
