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
