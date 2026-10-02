import { describe, expect, it } from "vitest";
import { bookingsRange, total } from "./OverviewPanels";

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

describe("bookingsRange", () => {
  it("opens the bookings page on the range the Overview is showing", () => {
    expect(bookingsRange("7d")).toBe("7");
    expect(bookingsRange("30d")).toBe("30");
    expect(bookingsRange("90d")).toBe("90");
  });

  it("falls back to the widest window for a year or a custom span", () => {
    expect(bookingsRange("1y")).toBe("90");
    expect(bookingsRange("custom:2026-01-01:2026-02-01")).toBe("90");
  });
});
