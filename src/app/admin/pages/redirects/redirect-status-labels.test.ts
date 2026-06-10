import { describe, expect, it } from "vitest";

import {
  REDIRECT_STATUS_OPTIONS,
  redirectStatusLabel,
} from "./redirect-status-labels";

// N18 / I11: redirect status codes must read words-first, never as a bare
// number, and the create form + row edit/display must share one vocabulary.
describe("redirectStatusLabel (issue I11)", () => {
  it("labels each supported code words-first", () => {
    expect(redirectStatusLabel(301)).toBe("Permanent move (301)");
    expect(redirectStatusLabel(302)).toBe("Temporary move (302)");
    expect(redirectStatusLabel(307)).toBe("Temporary redirect (307)");
    expect(redirectStatusLabel(308)).toBe("Permanent redirect (308)");
  });

  it("never returns a bare number for an unknown code", () => {
    expect(redirectStatusLabel(399)).toBe("Redirect (399)");
    expect(redirectStatusLabel(399)).not.toMatch(/^\d+$/);
  });

  it("exposes all four supported codes as options", () => {
    expect(REDIRECT_STATUS_OPTIONS.map((o) => o.code)).toEqual([
      301, 302, 307, 308,
    ]);
  });
});
