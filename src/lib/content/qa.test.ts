import { describe, expect, it } from "vitest";
import { parseQaStart, safeZoomLink } from "./qa";

const OCT_1_2026 = Date.parse("2026-10-01T12:00:00Z");

describe("parseQaStart", () => {
  it("reads the live GHL value as 1:30pm Central", () => {
    expect(
      parseQaStart(
        "Thursday, October 8 at 1:30pm Central Time",
        OCT_1_2026,
      )?.toISOString(),
    ).toBe("2026-10-08T18:30:00.000Z");
  });

  it("uses CST after the November switch", () => {
    expect(
      parseQaStart(
        "Thursday, November 12 at 1:30pm Central Time",
        OCT_1_2026,
      )?.toISOString(),
    ).toBe("2026-11-12T19:30:00.000Z");
  });

  it("rolls a January date read in December into next year", () => {
    const dec = Date.parse("2026-12-20T12:00:00Z");
    expect(
      parseQaStart(
        "Thursday, January 7 at 1:30pm Central Time",
        dec,
      )?.toISOString(),
    ).toBe("2027-01-07T19:30:00.000Z");
  });

  it("keeps a recently passed date in the current year", () => {
    expect(
      parseQaStart(
        "Thursday, September 17 at 1:30pm Central Time",
        OCT_1_2026,
      )?.toISOString(),
    ).toBe("2026-09-17T18:30:00.000Z");
  });

  it("returns null for text with no date", () => {
    expect(parseQaStart("TBD", OCT_1_2026)).toBeNull();
  });
});

describe("safeZoomLink", () => {
  it("accepts the Zoom registration link", () => {
    const link =
      "https://us06web.zoom.us/webinar/register/WN__fGZJG6cQn2fvr1sQ8Q26w";
    expect(safeZoomLink(` ${link} `)).toBe(link);
  });

  it.each([
    undefined,
    "",
    "not a url",
    "http://us06web.zoom.us/webinar/register/x",
    "javascript:alert(1)",
    "https://zoom.us.evil.com/x",
    "https://evilzoom.us/x",
  ])("rejects %s", (value) => {
    expect(safeZoomLink(value)).toBeNull();
  });
});
