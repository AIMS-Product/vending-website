import { describe, expect, it } from "vitest";
import {
  dotToneClass,
  pageStatusDotTone,
  pageStatusLabel,
  pageStatusLegend,
  readinessDotTone,
  readinessLegend,
} from "./seo-pages-status-labels";

describe("pageStatusLabel", () => {
  it("maps known statuses to marketer-facing labels", () => {
    expect(pageStatusLabel("published")).toBe("Published");
    expect(pageStatusLabel("draft")).toBe("Draft");
    expect(pageStatusLabel("archived")).toBe("Archived");
  });

  it("title-cases unknown statuses as a fallback", () => {
    expect(pageStatusLabel("scheduled")).toBe("Scheduled");
  });
});

describe("tone mapping", () => {
  it("maps page status to a tone", () => {
    expect(pageStatusDotTone("published")).toBe("green");
    expect(pageStatusDotTone("archived")).toBe("slate");
    expect(pageStatusDotTone("draft")).toBe("amber");
  });

  it("maps readiness status to a tone", () => {
    expect(readinessDotTone("strong")).toBe("green");
    expect(readinessDotTone("blocked")).toBe("red");
    expect(readinessDotTone("needs_work")).toBe("amber");
    expect(readinessDotTone("opportunities")).toBe("blue");
  });

  it("gives every tone a non-empty colour class", () => {
    for (const tone of ["green", "amber", "red", "slate", "blue"] as const) {
      expect(dotToneClass(tone)).toMatch(/^bg-/);
    }
  });
});

describe("legends", () => {
  it("covers every page status state", () => {
    expect(pageStatusLegend.map((entry) => entry.label)).toEqual([
      "Published",
      "Draft",
      "Archived",
    ]);
  });

  it("covers every readiness state", () => {
    expect(readinessLegend.map((entry) => entry.label)).toEqual([
      "Strong",
      "Opportunities",
      "Needs work",
      "Blocked",
    ]);
  });
});
