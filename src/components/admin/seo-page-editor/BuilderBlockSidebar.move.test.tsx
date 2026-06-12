import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BuilderBlockSidebar } from "./SeoPageEditorShell";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import type { BuilderBlockEntry } from "@/lib/page-builder/editor-helpers";

/**
 * Issue I4 / R3-5: the outline rows must offer up/down reorder controls that
 * drive the existing moveBlock action. The repo's vitest environment is
 * `node` (no jsdom / @testing-library), so interaction is exercised the same
 * way the rest of this directory does it: render assertions via
 * renderToStaticMarkup, and click behavior by invoking the onClick props of
 * real <button> elements found in the element tree (BuilderBlockSidebar is a
 * hook-free function component, so calling it directly is safe).
 */

const noop = () => undefined;

function makeEntry(input: {
  id: string;
  sectionId: string;
  columnId: string;
  blockIndex: number;
  blockNumber: number;
  sectionNumber: number;
  columnNumber: number;
}): BuilderBlockEntry {
  return {
    sectionId: input.sectionId,
    columnId: input.columnId,
    block: createPageBlock("rich_text", input.id),
    blockIndex: input.blockIndex,
    blockNumber: input.blockNumber,
    sectionNumber: input.sectionNumber,
    columnNumber: input.columnNumber,
  };
}

// Two blocks in section 1 / column 1, plus a lone block in section 2 /
// column 1 — locks the per-column boundary semantics moveBlock operates on.
function makeEntries(): BuilderBlockEntry[] {
  return [
    makeEntry({
      id: "b1",
      sectionId: "s1",
      columnId: "c1",
      blockIndex: 0,
      blockNumber: 1,
      sectionNumber: 1,
      columnNumber: 1,
    }),
    makeEntry({
      id: "b2",
      sectionId: "s1",
      columnId: "c1",
      blockIndex: 1,
      blockNumber: 2,
      sectionNumber: 1,
      columnNumber: 1,
    }),
    makeEntry({
      id: "b3",
      sectionId: "s2",
      columnId: "c2",
      blockIndex: 0,
      blockNumber: 3,
      sectionNumber: 2,
      columnNumber: 1,
    }),
  ];
}

function renderSidebar(
  entries: BuilderBlockEntry[],
  onMoveBlock: (entry: BuilderBlockEntry, direction: "up" | "down") => void,
) {
  return (
    <BuilderBlockSidebar
      entries={entries}
      selectedEntry={null}
      onSelectBlock={noop}
      onEditBlock={noop}
      onCreateBlock={noop}
      onCreateBlockAfter={noop}
      onMoveBlock={onMoveBlock}
    />
  );
}

// BuilderBlockSidebar is a hook-free function component, so invoking it
// directly yields its element tree without needing a DOM renderer.
function sidebarTree(
  entries: BuilderBlockEntry[],
  onMoveBlock: (entry: BuilderBlockEntry, direction: "up" | "down") => void,
) {
  return BuilderBlockSidebar({
    entries,
    selectedEntry: null,
    onSelectBlock: noop,
    onEditBlock: noop,
    onCreateBlock: noop,
    onCreateBlockAfter: noop,
    onMoveBlock,
  });
}

type ButtonElement = ReactElement<{
  "aria-label"?: string;
  disabled?: boolean;
  onClick?: () => void;
  children?: unknown;
}>;

/** Collects every plain <button> element in a React element tree. */
function findButtons(
  node: unknown,
  out: ButtonElement[] = [],
): ButtonElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findButtons(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const element = node as ButtonElement;
  if (element.type === "button") out.push(element);
  const props = element.props as { children?: unknown };
  if (props.children !== undefined) findButtons(props.children, out);
  return out;
}

function buttonByLabel(buttons: ButtonElement[], label: string): ButtonElement {
  const match = buttons.find((button) => button.props["aria-label"] === label);
  if (!match) throw new Error(`No button with aria-label "${label}"`);
  return match;
}

describe("BuilderBlockSidebar outline reorder controls (issue I4 / R3-5)", () => {
  it("renders keyboard-accessible move up/down buttons on every row", () => {
    const html = renderToStaticMarkup(renderSidebar(makeEntries(), noop));

    for (const blockNumber of [1, 2, 3]) {
      expect(html).toContain(`aria-label="Move block ${blockNumber} up"`);
      expect(html).toContain(`aria-label="Move block ${blockNumber} down"`);
    }
    // Real <button> elements, not divs with handlers.
    expect(html).toMatch(/<button[^>]*aria-label="Move block 1 up"/);
  });

  it("disables up on the first block and down on the last block of a column", () => {
    const buttons = findButtons(sidebarTree(makeEntries(), noop));

    // First block in s1/c1: can't move up, can move down.
    expect(buttonByLabel(buttons, "Move block 1 up").props.disabled).toBe(true);
    expect(buttonByLabel(buttons, "Move block 1 down").props.disabled).toBe(
      false,
    );
    // Last block in s1/c1: can move up, can't move down.
    expect(buttonByLabel(buttons, "Move block 2 up").props.disabled).toBe(
      false,
    );
    expect(buttonByLabel(buttons, "Move block 2 down").props.disabled).toBe(
      true,
    );
    // Only block in s2/c2: both directions disabled.
    expect(buttonByLabel(buttons, "Move block 3 up").props.disabled).toBe(true);
    expect(buttonByLabel(buttons, "Move block 3 down").props.disabled).toBe(
      true,
    );
  });

  it("calls onMoveBlock with the row's entry and the clicked direction", () => {
    const entries = makeEntries();
    const onMoveBlock = vi.fn();
    const buttons = findButtons(sidebarTree(entries, onMoveBlock));

    buttonByLabel(buttons, "Move block 2 up").props.onClick?.();
    expect(onMoveBlock).toHaveBeenCalledTimes(1);
    expect(onMoveBlock).toHaveBeenLastCalledWith(entries[1], "up");

    buttonByLabel(buttons, "Move block 1 down").props.onClick?.();
    expect(onMoveBlock).toHaveBeenCalledTimes(2);
    expect(onMoveBlock).toHaveBeenLastCalledWith(entries[0], "down");
  });

  it("leaves the existing select / edit-settings / add-below controls in place", () => {
    const html = renderToStaticMarkup(renderSidebar(makeEntries(), noop));

    expect(html).toContain('aria-label="Edit Rich text settings"');
    expect(html).toContain('aria-label="Add block below block 1"');
    expect(html).toContain("Section 1, column 1");
  });
});
