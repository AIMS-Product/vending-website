import { describe, expect, it } from "vitest";
import {
  checkAvailabilityClaims,
  mentionsAvailability,
} from "./availability-guard";

// Conversation 68ead512, 2026-09-11 ~8:50am Eastern. Real shape of the
// calendar that morning: nothing Fri-Sun, open Mon 14 / Tue 15 / Wed 16.
const input = {
  timeZone: "America/New_York",
  now: new Date("2026-09-11T12:50:00Z"),
  slots: [
    "2026-09-14T14:00:00Z", // Mon 10:00 am
    "2026-09-14T14:30:00Z", // Mon 10:30 am
    "2026-09-15T13:00:00Z", // Tue 9:00 am
    "2026-09-15T20:30:00Z", // Tue 4:30 pm
    "2026-09-16T18:00:00Z", // Wed 2:00 pm
  ],
};

describe("checkAvailabilityClaims", () => {
  it("replaces a false 'full' with that day's real times and the right weekday", () => {
    expect(
      checkAvailabilityClaims(
        "It looks like Monday the 15th is full, but there are openings later that week.",
        input,
      ),
    ).toBe("Tuesday, Sep 15 has 9:00 am or 4:30 pm open. Would one of those work?");
  });

  it("answers a truly empty day with the nearest open times, never 'full'", () => {
    expect(
      checkAvailabilityClaims(
        "Tomorrow is fully booked, but there are open slots later in the week.",
        input,
      ),
    ).toBe(
      "The closest open times are Monday, Sep 14 at 10:00 am or 10:30 am. Would one of those work?",
    );
  });

  it("corrects a wrong weekday and keeps a real time", () => {
    expect(
      checkAvailabilityClaims(
        "Monday the 15th works, take the 4:30 pm on the calendar.",
        input,
      ),
    ).toBe("Tuesday the 15th works, take the 4:30 pm on the calendar.");
  });

  it("replaces an invented time, even inside an 'if'", () => {
    expect(
      checkAvailabilityClaims(
        "If you want, grab 4:30 pm on the 16th on the calendar.",
        input,
      ),
    ).toBe("Wednesday, Sep 16 has 2:00 pm open. Would that work?");
  });

  it("says the corrected times once, not per false sentence", () => {
    expect(
      checkAvailabilityClaims(
        "Today is fully booked. Tomorrow is also full. Happy to help either way.",
        input,
      ),
    ).toBe(
      "The closest open times are Monday, Sep 14 at 10:00 am or 10:30 am. Would one of those work? Happy to help either way.",
    );
  });

  it("offers a callback when the calendar has nothing at all", () => {
    expect(
      checkAvailabilityClaims("Today is fully booked.", { ...input, slots: [] }),
    ).toMatch(/callback today or tomorrow/);
  });

  it("keeps paragraphs", () => {
    expect(
      checkAvailabilityClaims("Got it.\n\nMonday the 15th is full.", input),
    ).toBe(
      "Got it.\n\nTuesday, Sep 15 has 9:00 am or 4:30 pm open. Would one of those work?",
    );
  });

  it.each([
    "If a time you want isn't available on the calendar, I can have a teammate text you.",
    "You're all set for Tuesday at 11:00 am.",
    "The price isn't available in chat, the team covers it on the call.",
    "She works 7:00 am to 3:00 pm and runs her route after.",
    "What do you do for work now?",
  ])("leaves a sentence it cannot or should not judge alone: %j", (text) => {
    expect(checkAvailabilityClaims(text, input)).toBe(text);
  });
});

describe("mentionsAvailability", () => {
  it("only fires when a rule could apply", () => {
    expect(mentionsAvailability("Tomorrow is fully booked.")).toBe(true);
    expect(mentionsAvailability("Take the 4:30 pm.")).toBe(true);
    expect(mentionsAvailability("Monday the 15th works.")).toBe(true);
    expect(mentionsAvailability("What do you do for work now?")).toBe(false);
  });
});
