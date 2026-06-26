import { describe, expect, it } from "vitest";
import { shouldSkipAttributionTracking } from "./AttributionSessionTracker";

describe("shouldSkipAttributionTracking", () => {
  it("skips admin routes without excluding public pages", () => {
    expect(shouldSkipAttributionTracking("/admin")).toBe(true);
    expect(shouldSkipAttributionTracking("/admin/leads")).toBe(true);
    expect(shouldSkipAttributionTracking("/apply")).toBe(false);
    expect(shouldSkipAttributionTracking("/resources/admin-guide")).toBe(false);
  });
});
