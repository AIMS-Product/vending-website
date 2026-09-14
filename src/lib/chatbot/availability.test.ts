import { describe, expect, it } from "vitest";
import {
  describeAvailability,
  fetchChatbotAvailability,
  safeTimeZone,
  upcomingDays,
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

  it("returns every slot for a requested day, uncapped, and says the list is complete", () => {
    const slots = [
      "2026-08-31T19:00:00Z", // 12:00pm PT
      "2026-08-31T19:15:00Z",
      "2026-08-31T19:30:00Z",
      "2026-08-31T21:00:00Z", // 2:00pm PT
      "2026-09-01T19:00:00Z",
    ];
    const now = new Date("2026-08-30T12:00:00Z");
    const text = describeAvailability(slots, "America/Los_Angeles", {
      day: "2026-08-31",
      now,
    });
    expect(text).toContain("12:00 pm, 12:15 pm, 12:30 pm, 2:00 pm");
    expect(text).toMatch(/complete for that day/);
    expect(text).not.toContain("Sep 1");
    expect(
      describeAvailability(slots, "America/Los_Angeles", {
        day: "2026-09-05",
        now,
      }),
    ).toMatch(/No open times on 2026-09-05/);
  });

  // The 2026-09-11 bug: the model asked for last year's date and relayed
  // "No open times" as "the 15th is full" while the 15th had 41 open slots.
  it("never reports a wrong-year or out-of-window day as having no open times", () => {
    const now = new Date("2026-09-11T12:37:00Z");
    const past = describeAvailability([], "America/New_York", {
      day: "2025-09-15",
      now,
    });
    expect(past).toMatch(/in the past: today is 2026-09-11/);
    expect(past).not.toMatch(/No open times/);

    const beyond = describeAvailability([], "America/New_York", {
      day: "2026-10-02",
      now,
    });
    expect(beyond).toMatch(/Never say it is unavailable/);
    expect(beyond).not.toMatch(/No open times/);

    expect(
      describeAvailability(["2026-09-15T14:00:00Z"], "America/New_York", {
        day: "2026-09-15",
        now,
      }),
    ).toContain("10:00 am");
  });
});

describe("upcomingDays", () => {
  it("labels real weekdays in the visitor's zone", () => {
    const days = upcomingDays("America/New_York", new Date("2026-09-11T12:37:00Z"));
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ iso: "2026-09-11", label: "Fri, Sep 11" });
    expect(days[4]).toEqual({ iso: "2026-09-15", label: "Tue, Sep 15" });
    // 8pm Friday in LA is already Saturday in UTC.
    expect(
      upcomingDays("America/Los_Angeles", new Date("2026-09-12T03:00:00Z"))[0].iso,
    ).toBe("2026-09-11");
  });

  it("neither skips nor repeats a day across a DST change", () => {
    const days = upcomingDays("America/New_York", new Date("2026-11-01T04:30:00Z"));
    expect(new Set(days.map((d) => d.iso)).size).toBe(14);
    expect(days[1].iso).toBe("2026-11-02");
  });

  it("warns the model that the summary is capped", () => {
    const text = describeAvailability(
      ["2026-08-31T19:00:00Z"],
      "America/Los_Angeles",
    );
    expect(text).toMatch(/this is a SUMMARY/);
    expect(text).toMatch(/Never tell a visitor a specific time is unavailable/);
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

  it("never lets the model say there is no availability; it presents options", () => {
    const text = describeAvailability([], "America/Chicago");
    expect(text).toMatch(/NEVER tell the visitor there is no availability/);
    expect(text).toMatch(/callback today or tomorrow/);
    expect(text).toMatch(/within the hour/);
    expect(text).toMatch(/flag_for_team/);
    expect(text).toMatch(/Never invent a clock time/);
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
