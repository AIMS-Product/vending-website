// I16 / N14: keyboard shortcuts for the SEO page editor. The pure matcher
// below decides which editor action a keydown maps to (or none), so the
// modifier matrix and the typing-suppression rule are unit-testable without a
// DOM. The hook in `useEditorKeyboardShortcuts.ts` wires the matched action to
// the EXISTING affordances (save submit, the real Publish button, the block
// picker trigger) — it never reimplements save/publish logic.

export type EditorShortcutAction = "save" | "publish" | "open-block-picker";

export type EditorShortcutEvent = {
  key: string;
  /** Cmd on macOS. */
  metaKey: boolean;
  /** Ctrl elsewhere. */
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** Whether focus is inside a text-entry control (input/textarea/select/contenteditable). */
  isTextEntryTarget: boolean;
};

/**
 * Maps a keydown to an editor action, or `null` when no shortcut applies.
 *
 * - Cmd/Ctrl+S → save (always, even while typing — matches the native intent).
 * - Cmd/Ctrl+Enter → publish (always — submitting from a field is expected).
 * - "/" → open block picker, but ONLY when focus is not in a text field
 *   (otherwise the user is typing a slash into their content).
 *
 * Alt is never part of these chords; an Alt-modified press is ignored so we
 * don't shadow OS/browser combos. Shift is allowed (Cmd+Shift+S etc. still
 * saves) to be forgiving, but "/" requires no Cmd/Ctrl.
 */
export function resolveEditorShortcut(
  event: EditorShortcutEvent,
): EditorShortcutAction | null {
  if (event.altKey) return null;

  const hasPrimaryModifier = event.metaKey || event.ctrlKey;

  // Both Cmd and Ctrl held is ambiguous (and not a real chord we own).
  if (event.metaKey && event.ctrlKey) return null;

  if (hasPrimaryModifier && (event.key === "s" || event.key === "S")) {
    return "save";
  }

  if (hasPrimaryModifier && event.key === "Enter") {
    return "publish";
  }

  if (!hasPrimaryModifier && event.key === "/" && !event.isTextEntryTarget) {
    return "open-block-picker";
  }

  return null;
}

/** Whether an event target is a text-entry control where "/" must pass through. */
export function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}
