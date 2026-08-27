import { describe, expect, it } from "vitest";
import {
  countExclamations,
  humanizeChatbotReply,
  needsCalendarGuard,
  rewriteForOpenCalendar,
} from "./humanize";

describe("humanizeChatbotReply", () => {
  it("drops the forbidden openers the live transcripts kept producing", () => {
    expect(
      humanizeChatbotReply(
        "That's awesome! If you're looking for inspiration, one of our members is a detective.",
        { exclamationsAlreadyUsed: 0 },
      ),
    ).toBe(
      "If you're looking for inspiration, one of our members is a detective.",
    );
    expect(
      humanizeChatbotReply("Absolutely! You're eligible.", {
        exclamationsAlreadyUsed: 0,
      }),
    ).toBe("You're eligible.");
    expect(
      humanizeChatbotReply("That's great to hear! Do you have ideas?", {
        exclamationsAlreadyUsed: 0,
      }),
    ).toBe("Do you have ideas?");
  });

  it("allows one exclamation mark per conversation and no more", () => {
    expect(
      humanizeChatbotReply("Nice! Grab a time! Talk soon!", {
        exclamationsAlreadyUsed: 0,
      }),
    ).toBe("Nice! Grab a time. Talk soon.");
    expect(
      humanizeChatbotReply("Nice! Grab a time!", {
        exclamationsAlreadyUsed: 1,
      }),
    ).toBe("Nice. Grab a time.");
  });

  it("never returns an empty reply", () => {
    expect(
      humanizeChatbotReply("Awesome!", { exclamationsAlreadyUsed: 0 }),
    ).toBe("Awesome!");
  });

  it("counts exclamations across prior replies", () => {
    expect(countExclamations(["Hi!", "ok", "yes!!"])).toBe(3);
  });
});

describe("calendar guard", () => {
  it("catches the exact misses from the live transcripts", () => {
    expect(
      needsCalendarGuard(
        "I'll open the calendar for you so you can pick a time that works best. One moment!",
      ),
    ).toBe(true);
    expect(
      needsCalendarGuard(
        "You can grab a time to book a call [here](/book-now). Let me know if you have any questions!",
      ),
    ).toBe(true);
    expect(
      needsCalendarGuard(
        "I can't show the calendar directly, but you can pick a time [here](/book-now).",
      ),
    ).toBe(true);
    expect(
      needsCalendarGuard(
        "I can't send you the entire Calendly link, but I can set up a call for next week.",
      ),
    ).toBe(true);
  });

  it("leaves ordinary replies and other links alone", () => {
    expect(
      needsCalendarGuard(
        "we've got a free [90-day roadmap](/resources/roadmap) that walks through it",
      ),
    ).toBe(false);
    expect(needsCalendarGuard("What do you do for work now?")).toBe(false);
  });

  it("rewrites the reply for a calendar that is now open", () => {
    expect(
      rewriteForOpenCalendar(
        "Yes, we do! You can easily book a free strategy call with us. I'll open the calendar for you so you can pick a time. One moment!",
      ),
    ).toBe("Yes, we do! You can easily book a free strategy call with us.");
    expect(
      rewriteForOpenCalendar("Want to pick a time [here](/book-now)?"),
    ).toBe("Want to pick a time right here in the chat?");
  });
});
