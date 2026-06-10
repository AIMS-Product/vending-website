import { describe, expect, it } from "vitest";

import { getMobileActionBarState } from "./editor-responsive";

/**
 * Guards issue I10 / N11: the mobile editor needs a persistent action bar
 * (Save + SEO/publish entry) that only renders at narrow widths and reflects
 * whether the SEO panel is open.
 */
describe("getMobileActionBarState (issue I10)", () => {
  it("shows the bar only at narrow widths", () => {
    expect(
      getMobileActionBarState({
        isNarrowEditor: true,
        isSeoSidebarCollapsed: true,
      }).visible,
    ).toBe(true);
    expect(
      getMobileActionBarState({
        isNarrowEditor: false,
        isSeoSidebarCollapsed: true,
      }).visible,
    ).toBe(false);
  });

  it("offers to open the SEO/publish panel when it is collapsed", () => {
    const state = getMobileActionBarState({
      isNarrowEditor: true,
      isSeoSidebarCollapsed: true,
    });
    expect(state.seoPanelOpen).toBe(false);
    expect(state.seoButtonLabel).toBe("SEO & publish");
  });

  it("offers to close the SEO/publish panel when it is open", () => {
    const state = getMobileActionBarState({
      isNarrowEditor: true,
      isSeoSidebarCollapsed: false,
    });
    expect(state.seoPanelOpen).toBe(true);
    expect(state.seoButtonLabel).toBe("Close SEO panel");
  });
});
