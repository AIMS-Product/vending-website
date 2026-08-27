import { describe, expect, it } from "vitest";
import {
  describeAvailability,
  fetchChatbotAvailability,
  safeTimeZone,
} from "./availability";

describe("describeAvailability", () => {
  it("groups by the visitor's day and buckets evenings separately", () => {
    const text = describeAvailability(
      [
        "2026-08-27T14:15:00Z", // 10:15am Eastern
        "2026-08-27T22:45:00Z", // 6:45pm Eastern
        "2026-08-28T13:00:00Z", // 9:00am Eastern
      ],
      "America/New_York",
    );
    expect(text).toContain("Thu, Aug 27: morning 10:15 am | evening 6:45 pm");
    expect(text).toContain("Fri, Aug 28: morning 9:00 am");
    expect(text).toContain("Earliest: Thu, Aug 27 at 10:15 am.");
  });

  it("caps each bucket so the tool result stays short", () => {
    const slots = Array.from(
      { length: 8 },
      (_, i) => `2026-08-27T${String(13 + i).padStart(2, "0")}:00:00Z`,
    );
    const text = describeAvailability(slots, "America/New_York", {
      perBucket: 2,
    });
    expect(text).toContain("morning 9:00 am, 10:00 am");
    expect(text).toContain("afternoon 12:00 pm, 1:00 pm");
  });

  it("tells the model to take a callback when nothing is open", () => {
    const text = describeAvailability([], "America/Chicago");
    expect(text).toMatch(/No open times/);
    expect(text).toMatch(/flag_for_team/);
    expect(text).toMatch(/Do not invent/);
  });

  it("falls back to Eastern on a bad time zone", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe("America/New_York");
    expect(safeTimeZone("America/Denver")).toBe("America/Denver");
  });
});

describe("fetchChatbotAvailability", () => {
  it("walks the horizon in 7-day windows and merges sorted", async () => {
    const calls: Array<[string, string]> = [];
    const slots = await fetchChatbotAvailability({
      timeZone: "America/New_York",
      now: new Date("2026-08-27T12:00:00Z"),
      eventTypeUri: "https://api.calendly.com/event_types/test-window",
      fetchSlots: async (start, end) => {
        calls.push([start, end]);
        return calls.length === 1
          ? ["2026-08-29T15:00:00Z"]
          : ["2026-09-05T15:00:00Z"];
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe("2026-08-27T12:01:00.000Z");
    expect(calls[1][1]).toBe("2026-09-10T12:00:00.000Z");
    expect(slots).toEqual(["2026-08-29T15:00:00Z", "2026-09-05T15:00:00Z"]);
  });
});
