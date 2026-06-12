const narrowEditorMediaQuery = "(max-width: 1279px)";

export function subscribeToNarrowEditorChange(onStoreChange: () => void) {
  const media = window.matchMedia(narrowEditorMediaQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

export function getNarrowEditorSnapshot() {
  return window.matchMedia(narrowEditorMediaQuery).matches;
}

export function getNarrowEditorServerSnapshot() {
  return false;
}

/**
 * I10 / N11: the mobile editor pins a fixed bottom action bar so Save and the
 * SEO/publish entry stay reachable without scrolling. Its label/affordance
 * derives purely from the current panel state, so it lives here as a tested
 * pure helper rather than as inline JSX conditionals.
 */
export type MobileActionBarState = {
  /** The bar only exists at narrow widths; desktop keeps the top-rail layout. */
  visible: boolean;
  /** Label for the SEO/publish entry — reflects whether the panel is open. */
  seoButtonLabel: string;
  /** Whether the SEO/publish entry is currently showing the panel. */
  seoPanelOpen: boolean;
};

export function getMobileActionBarState({
  isNarrowEditor,
  isSeoSidebarCollapsed,
}: {
  isNarrowEditor: boolean;
  isSeoSidebarCollapsed: boolean;
}): MobileActionBarState {
  return {
    visible: isNarrowEditor,
    seoPanelOpen: !isSeoSidebarCollapsed,
    seoButtonLabel: isSeoSidebarCollapsed ? "SEO & publish" : "Close SEO panel",
  };
}
