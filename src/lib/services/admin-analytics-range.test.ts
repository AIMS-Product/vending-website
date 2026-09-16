import { describe, expect, it } from "vitest";
import {
  parseAdminAnalyticsRange,
  resolveAdminAnalyticsRange,
  toCustomRangeKey,
} from "./admin-analytics-range";

const NOW = new Date("2026-09-16T12:00:00.000Z");

describe("parseAdminAnalyticsRange", () => {
  it("keeps presets and falls back for junk", () => {
    expect(parseAdminAnalyticsRange("90d")).toBe("90d");
    expect(parseAdminAnalyticsRange("nonsense")).toBe("30d");
    expect(parseAdminAnalyticsRange(null)).toBe("30d");
  });

  it("accepts a well-formed custom window", () => {
    expect(parseAdminAnalyticsRange("custom:2026-01-01:2026-03-31")).toBe(
      "custom:2026-01-01:2026-03-31",
    );
  });

  it("rejects backwards, unreal, malformed and oversized windows", () => {
    for (const bad of [
      "custom:2026-03-31:2026-01-01",
      "custom:2026-02-30:2026-03-01",
      "custom:2026-01-01",
      "custom:01/01/2026:03/31/2026",
      "custom:2000-01-01:2026-01-01",
    ]) {
      expect(parseAdminAnalyticsRange(bad)).toBe("30d");
    }
  });
});

describe("resolveAdminAnalyticsRange", () => {
  it("anchors a preset on now and leaves its width alone", () => {
    const resolved = resolveAdminAnalyticsRange("7d", NOW);
    expect(resolved.days).toBe(7);
    expect(resolved.endsAt).toEqual(NOW);
    expect(resolved.startDay).toBeUndefined();
  });

  it("resolves a custom window inclusively and ends on its last day", () => {
    const resolved = resolveAdminAnalyticsRange(
      "custom:2026-01-01:2026-01-31",
      NOW,
    );
    expect(resolved.days).toBe(31);
    expect(resolved.endsAt.toISOString().slice(0, 10)).toBe("2026-01-31");
    // What the day-keyed rollups compute: endsAt back (days - 1) days.
    expect(
      new Date(resolved.endsAt.getTime() - (resolved.days - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-01-01");
    expect(resolved.label).toBe("Jan 1, 2026 – Jan 31, 2026");
  });

  it("covers a single day", () => {
    expect(
      resolveAdminAnalyticsRange("custom:2026-02-28:2026-02-28").days,
    ).toBe(1);
  });
});

describe("toCustomRangeKey", () => {
  it("only builds a key when both ends are present", () => {
    expect(toCustomRangeKey("2026-01-01", "2026-03-31")).toBe(
      "custom:2026-01-01:2026-03-31",
    );
    expect(toCustomRangeKey("2026-01-01", null)).toBeNull();
    expect(toCustomRangeKey(undefined, undefined)).toBeNull();
  });
});
