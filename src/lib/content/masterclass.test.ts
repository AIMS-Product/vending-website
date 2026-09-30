import { describe, expect, it } from "vitest";
import { calendarLinks, parseWebinarStart } from "./masterclass";

describe("parseWebinarStart", () => {
  it("reads the GHL date value as Central time", () => {
    expect(
      parseWebinarStart("October 6, 2026 at 7:30 PM CDT")?.toISOString(),
    ).toBe("2026-10-07T00:30:00.000Z");
    expect(
      parseWebinarStart(
        "October 6, 2026 Tuesday at 7:30 PM CDT",
      )?.toISOString(),
    ).toBe("2026-10-07T00:30:00.000Z");
  });

  it("uses the real Chicago offset, not the written zone: 'CST' in September is still CDT", () => {
    expect(
      parseWebinarStart("September 1, 2026 at 12 PM CST")?.toISOString(),
    ).toBe("2026-09-01T17:00:00.000Z");
  });

  it("switches to CST after daylight saving ends", () => {
    expect(
      parseWebinarStart("November 10, 2026 at 12 PM CST")?.toISOString(),
    ).toBe("2026-11-10T18:00:00.000Z");
  });

  it("returns null rather than guessing on text it cannot read", () => {
    expect(parseWebinarStart("next Tuesday")).toBeNull();
    expect(parseWebinarStart("Octember 6, 2026 at 7 PM")).toBeNull();
  });
});

describe("calendarLinks", () => {
  it("builds a 75-minute event in UTC for Google and a downloadable ics", () => {
    const links = calendarLinks({
      title: "Masterclass",
      details: "Zoom link in your email",
      start: new Date("2026-10-07T00:30:00.000Z"),
      minutes: 75,
    });
    expect(new URL(links.google).searchParams.get("dates")).toBe(
      "20261007T003000Z/20261007T014500Z",
    );
    expect(decodeURIComponent(links.ics)).toContain("DTSTART:20261007T003000Z");
  });
});
