import { describe, expect, it } from "vitest";
import { focusTrapTarget } from "./focus-trap";

const container = { id: "dialog" };
const a = { id: "a" };
const b = { id: "b" };
const c = { id: "c" };
const all = [a, b, c];

describe("focusTrapTarget", () => {
  it("wraps Tab from the last control to the first", () => {
    expect(focusTrapTarget(all, c, container, false)).toBe(a);
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    expect(focusTrapTarget(all, a, container, true)).toBe(c);
  });

  it("treats the focused dialog itself as before the first control", () => {
    expect(focusTrapTarget(all, container, container, true)).toBe(c);
  });

  it("leaves mid-list moves to the browser", () => {
    expect(focusTrapTarget(all, b, container, false)).toBeNull();
    expect(focusTrapTarget(all, b, container, true)).toBeNull();
  });

  it("does nothing when there is nothing to focus", () => {
    expect(focusTrapTarget([], container, container, false)).toBeNull();
  });
});
