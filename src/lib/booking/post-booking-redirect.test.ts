import { afterEach, describe, expect, it, vi } from "vitest";
import {
  goToPreCallResources,
  PRE_CALL_RESOURCES_PATH,
} from "./post-booking-redirect";

// Both booking surfaces — the page embeds and the chat widget — call this, so
// the destination being wrong would silently send every booker somewhere else.
describe("post-booking redirect", () => {
  const original = globalThis.window;

  afterEach(() => {
    globalThis.window = original;
    vi.restoreAllMocks();
  });

  function stubWindow(top: unknown) {
    const assign = vi.fn();
    const self = { location: { assign }, top } as unknown as Window &
      typeof globalThis;
    (self as unknown as { self: unknown }).self = self;
    globalThis.window = self;
    return assign;
  }

  it("sends bookers to the pre-call resources page", () => {
    expect(PRE_CALL_RESOURCES_PATH).toBe("/pre-call-resources");
  });

  it("navigates this window when it is the top window", () => {
    const assign = stubWindow(undefined);
    (globalThis.window as unknown as { top: unknown }).top = globalThis.window;
    goToPreCallResources();
    expect(assign).toHaveBeenCalledWith("/pre-call-resources");
  });

  it("breaks out of a frame so the page is not letterboxed", () => {
    const topAssign = vi.fn();
    const assign = stubWindow({ location: { assign: topAssign } });
    goToPreCallResources();
    expect(topAssign).toHaveBeenCalledWith("/pre-call-resources");
    expect(assign).not.toHaveBeenCalled();
  });

  it("falls back to this window when the top frame is cross-origin", () => {
    const assign = stubWindow(undefined);
    Object.defineProperty(globalThis.window, "top", {
      get() {
        throw new DOMException("cross-origin");
      },
    });
    goToPreCallResources();
    expect(assign).toHaveBeenCalledWith("/pre-call-resources");
  });
});
