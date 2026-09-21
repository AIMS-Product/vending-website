import { describe, expect, it } from "vitest";
import { total } from "./OverviewPanels";

// The Overview tile read "Leads 109" for a week that captured 1,308 people,
// because site form fills and total capture differ by more than 10x
// (REPORTING.md section 2). These pin the replacement.
describe("total captured", () => {
  it("adds contacts to leads", () => {
    expect(total(109, 1199)).toBe(1308);
  });

  it("counts a channel that reported only one of the two", () => {
    expect(total(null, 91)).toBe(91);
    expect(total(62, null)).toBe(62);
  });

  it("stays unobserved when neither was reported, never zero", () => {
    expect(total(null, null)).toBeNull();
  });

  it("keeps a real zero distinct from unobserved", () => {
    expect(total(0, null)).toBe(0);
  });
});
