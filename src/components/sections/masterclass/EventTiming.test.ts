import { describe, expect, it } from "vitest";
import { compactLeft, localTimeText } from "./EventTiming";

// Tuesday Oct 6 2026, 7:30 PM CDT.
const START = "2026-10-07T00:30:00.000Z";

describe("compactLeft", () => {
  it("shows days, then hours and minutes", () => {
    expect(compactLeft(((5 * 24 + 6) * 60 + 32) * 60_000 + 59_000)).toBe(
      "5d 06h 32m",
    );
    expect(compactLeft((6 * 60 + 2) * 60_000)).toBe("06h 02m");
    expect(compactLeft(59_000)).toBe("under a minute");
  });
});

describe("localTimeText", () => {
  it("is null on Central time", () => {
    expect(localTimeText(START, "America/Chicago")).toBeNull();
  });

  it("names the visitor's time and zone", () => {
    expect(localTimeText(START, "America/New_York")).toBe(
      "Your time: 8:30 PM EDT",
    );
    expect(localTimeText(START, "America/Los_Angeles")).toBe(
      "Your time: 5:30 PM PDT",
    );
  });

  it("names the weekday when the visitor's day differs", () => {
    expect(localTimeText(START, "Europe/London")).toBe(
      "Your time: Wed 1:30 AM GMT+1",
    );
  });

  it("is null for an unreadable date or zone", () => {
    expect(localTimeText("not a date", "America/New_York")).toBeNull();
    expect(localTimeText(START, "Not/AZone")).toBeNull();
  });
});
