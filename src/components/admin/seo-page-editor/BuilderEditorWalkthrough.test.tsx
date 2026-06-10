import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuilderEditorWalkthrough } from "./BuilderEditorWalkthrough";
import type { SeoPageEditorController } from "./useSeoPageEditorController";

// Minimal controller stub — only the fields the walkthrough reads/calls.
function editorStub(
  overrides: Partial<SeoPageEditorController> = {},
): SeoPageEditorController {
  return {
    builderWalkthroughStep: null,
    isBlockSidebarCollapsed: true,
    isSeoSidebarCollapsed: false,
    advanceBuilderWalkthrough: () => {},
    finishBuilderWalkthrough: () => {},
    dismissBuilderWalkthrough: () => {},
    toggleBlockSidebar: () => {},
    toggleSeoSidebar: () => {},
    ...overrides,
  } as unknown as SeoPageEditorController;
}

describe("BuilderEditorWalkthrough (opt-in)", () => {
  it("does NOT auto-render the tour overlay when the controller auto-sets a step", () => {
    // Simulate the controller's create-time auto-start (step = 1).
    const html = renderToStaticMarkup(
      <BuilderEditorWalkthrough
        editor={editorStub({ builderWalkthroughStep: 1 })}
      />,
    );

    // The intrusive overlay (modal dialog / step copy) must not appear on its own.
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Quick tour · Step");
    expect(html).not.toContain("Skip walkthrough");
  });

  it("offers a visible opt-in affordance to start the tour on demand", () => {
    const html = renderToStaticMarkup(
      <BuilderEditorWalkthrough editor={editorStub()} />,
    );

    // A discoverable launch control is present even when no tour is running.
    expect(html).toContain("Quick tour");
    expect(html).toMatch(/aria-label="(Start|Open) (the )?quick tour"/i);
  });
});
