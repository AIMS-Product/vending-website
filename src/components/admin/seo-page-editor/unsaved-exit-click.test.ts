import { describe, expect, it } from "vitest";
import { isPlainNavigationClick } from "./useUnsavedExitGuard";

// isPlainNavigationClick only reads numeric/boolean fields of the event, so a
// plain object stands in for a real MouseEvent without needing a DOM env.
function clickEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
  } as MouseEvent;
}

describe("isPlainNavigationClick", () => {
  it("accepts a plain unmodified left click", () => {
    expect(isPlainNavigationClick(clickEvent())).toBe(true);
  });

  it("ignores middle/right clicks", () => {
    expect(isPlainNavigationClick(clickEvent({ button: 1 }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ button: 2 }))).toBe(false);
  });

  it("ignores modifier-key clicks (open in new tab / window)", () => {
    expect(isPlainNavigationClick(clickEvent({ metaKey: true }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ ctrlKey: true }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ shiftKey: true }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ altKey: true }))).toBe(false);
  });

  it("ignores clicks another handler already prevented", () => {
    expect(isPlainNavigationClick(clickEvent({ defaultPrevented: true }))).toBe(
      false,
    );
  });
});
