import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuilderEditorWalkthrough } from "./BuilderEditorWalkthrough";
import type { SeoPageEditorController } from "./useSeoPageEditorController";

// Minimal controller stub — only the fields the walkthrough reads/calls. The
// legacy controller walkthrough state (builderWalkthroughStep etc.) is gone;
// the tour is fully self-driven from this component's own local step state.
function editorStub(
  overrides: Partial<SeoPageEditorController> = {},
): SeoPageEditorController {
  return {
    isBlockSidebarCollapsed: true,
    isSeoSidebarCollapsed: false,
    toggleBlockSidebar: () => {},
    toggleSeoSidebar: () => {},
    ...overrides,
  } as unknown as SeoPageEditorController;
}

describe("BuilderEditorWalkthrough (opt-in)", () => {
  it("does NOT auto-render the tour overlay on mount", () => {
    const html = renderToStaticMarkup(
      <BuilderEditorWalkthrough editor={editorStub()} />,
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
