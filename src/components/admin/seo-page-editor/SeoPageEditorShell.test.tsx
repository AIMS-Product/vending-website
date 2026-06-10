import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewPageChoiceGate } from "./SeoPageEditorShell";
import { pageTypeOptions } from "@/lib/page-builder/page-templates";

const noop = () => {};

describe("NewPageChoiceGate (one-step create)", () => {
  it("renders a single step, not a 3-step wizard", () => {
    const html = renderToStaticMarkup(
      <NewPageChoiceGate
        pageTypeOptions={pageTypeOptions}
        onChoosePageTemplate={noop}
      />,
    );

    // No multi-step scaffolding or forced progression.
    expect(html).not.toContain("Step 1 of 3");
    expect(html).not.toContain("Step 2 of 3");
    expect(html).not.toContain("Step 3 of 3");
    expect(html).not.toContain("Create page progress");
    expect(html).not.toContain(">Continue</button>");
  });

  it("offers every page type as a directly selectable choice", () => {
    const html = renderToStaticMarkup(
      <NewPageChoiceGate
        pageTypeOptions={pageTypeOptions}
        onChoosePageTemplate={noop}
      />,
    );

    for (const option of pageTypeOptions) {
      expect(html).toContain(option.label);
    }
  });

  it("exposes a single start-building action", () => {
    const html = renderToStaticMarkup(
      <NewPageChoiceGate
        pageTypeOptions={pageTypeOptions}
        onChoosePageTemplate={noop}
      />,
    );

    expect(html).toMatch(/Start building/);
  });
});
