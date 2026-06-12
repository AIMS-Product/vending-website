import { describe, expect, it } from "vitest";

import {
  resolveEditorShortcut,
  type EditorShortcutEvent,
} from "./editor-keyboard-shortcuts";

function ev(overrides: Partial<EditorShortcutEvent>): EditorShortcutEvent {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isTextEntryTarget: false,
    ...overrides,
  };
}

describe("resolveEditorShortcut (issue I16)", () => {
  it("maps Cmd+S and Ctrl+S to save", () => {
    expect(resolveEditorShortcut(ev({ key: "s", metaKey: true }))).toBe("save");
    expect(resolveEditorShortcut(ev({ key: "s", ctrlKey: true }))).toBe("save");
    // capitalised key (Shift held) still saves
    expect(resolveEditorShortcut(ev({ key: "S", ctrlKey: true }))).toBe("save");
  });

  it("does not treat bare 's' as save", () => {
    expect(resolveEditorShortcut(ev({ key: "s" }))).toBeNull();
  });

  it("maps Cmd+Enter and Ctrl+Enter to publish", () => {
    expect(resolveEditorShortcut(ev({ key: "Enter", metaKey: true }))).toBe(
      "publish",
    );
    expect(resolveEditorShortcut(ev({ key: "Enter", ctrlKey: true }))).toBe(
      "publish",
    );
  });

  it("does not treat bare Enter as publish", () => {
    expect(resolveEditorShortcut(ev({ key: "Enter" }))).toBeNull();
  });

  it("maps '/' to open-block-picker only when not typing", () => {
    expect(resolveEditorShortcut(ev({ key: "/" }))).toBe("open-block-picker");
    expect(
      resolveEditorShortcut(ev({ key: "/", isTextEntryTarget: true })),
    ).toBeNull();
  });

  it("ignores '/' when a primary modifier is held", () => {
    expect(resolveEditorShortcut(ev({ key: "/", metaKey: true }))).toBeNull();
    expect(resolveEditorShortcut(ev({ key: "/", ctrlKey: true }))).toBeNull();
  });

  it("ignores Alt-modified chords entirely", () => {
    expect(
      resolveEditorShortcut(ev({ key: "s", metaKey: true, altKey: true })),
    ).toBeNull();
    expect(
      resolveEditorShortcut(ev({ key: "Enter", ctrlKey: true, altKey: true })),
    ).toBeNull();
  });

  it("ignores the ambiguous Cmd+Ctrl combination", () => {
    expect(
      resolveEditorShortcut(ev({ key: "s", metaKey: true, ctrlKey: true })),
    ).toBeNull();
  });
});
