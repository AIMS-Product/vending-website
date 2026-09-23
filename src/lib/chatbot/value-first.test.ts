import { describe, expect, it } from "vitest";
import {
  chooseForcedTool,
  isValueFirstConversation,
  shouldHoldCalendar,
} from "./value-first";

describe("isValueFirstConversation", () => {
  it("is off unless the flag says otherwise", () => {
    expect(isValueFirstConversation("conv-1", undefined)).toBe(false);
    expect(isValueFirstConversation("conv-1", "")).toBe(false);
    expect(isValueFirstConversation("conv-1", "true")).toBe(false);
    expect(isValueFirstConversation("conv-1", "off")).toBe(false);
  });

  it("is on for everyone when set to on", () => {
    expect(isValueFirstConversation("conv-1", "on")).toBe(true);
    expect(isValueFirstConversation("conv-2", " ON ")).toBe(true);
  });

  it("splits conversations about evenly and stably when set to split", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `conversation-${i}`);
    const on = ids.filter((id) => isValueFirstConversation(id, "split"));
    expect(on.length).toBeGreaterThan(160);
    expect(on.length).toBeLessThan(240);
    for (const id of ids.slice(0, 20)) {
      expect(isValueFirstConversation(id, "split")).toBe(
        isValueFirstConversation(id, "split"),
      );
    }
  });
});

describe("shouldHoldCalendar", () => {
  it("never holds when value-first is off", () => {
    expect(
      shouldHoldCalendar({ valueFirst: false, visitorMessages: ["hi"] }),
    ).toBe(false);
  });

  it("holds the calendar on an early message with no booking ask", () => {
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["How does the program work?"],
      }),
    ).toBe(true);
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["How does the program work?", "I'm a teacher"],
      }),
    ).toBe(true);
  });

  it("releases it once they have engaged for three messages", () => {
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["How does it work?", "I'm a teacher", "ok"],
      }),
    ).toBe(false);
  });

  it("releases it the moment they ask to book, in any message", () => {
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["Can I book a call?"],
      }),
    ).toBe(false);
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["what is my first step?"],
      }),
    ).toBe(false);
  });

  it("releases it on the turn after a cost question", () => {
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["How much does it cost?"],
      }),
    ).toBe(true);
    expect(
      shouldHoldCalendar({
        valueFirst: true,
        visitorMessages: ["How much does it cost?", "a couple of machines"],
      }),
    ).toBe(false);
  });
});

describe("chooseForcedTool", () => {
  it("keeps today's rule when value-first is off: cost and booking both force the calendar", () => {
    const base = {
      valueFirst: false,
      hasSeenCalendar: false,
      priorMessages: [],
    };
    expect(
      chooseForcedTool({ ...base, message: "how much does it cost?" }),
    ).toBe("show_booking_calendar");
    expect(chooseForcedTool({ ...base, message: "book a call" })).toBe(
      "show_booking_calendar",
    );
    expect(chooseForcedTool({ ...base, message: "I'm a nurse" })).toBe(
      undefined,
    );
  });

  it("never forces a second calendar", () => {
    expect(
      chooseForcedTool({
        valueFirst: false,
        hasSeenCalendar: true,
        priorMessages: [],
        message: "book a call",
      }),
    ).toBe(undefined);
  });

  it("answers a first cost question with the cost video, not the calendar", () => {
    expect(
      chooseForcedTool({
        valueFirst: true,
        hasSeenCalendar: false,
        priorMessages: [],
        message: "How much does it cost to start?",
      }),
    ).toBe("share_resource");
  });

  it("does not force the video twice", () => {
    expect(
      chooseForcedTool({
        valueFirst: true,
        hasSeenCalendar: false,
        priorMessages: [
          {
            role: "assistant",
            content: "Shared a video in the chat.",
            ts: "2026-09-23T00:00:00Z",
            kind: "shared_resource",
            data: { key: "cost_to_join" },
          },
        ],
        message: "ok but roughly how much?",
      }),
    ).toBe(undefined);
  });

  it("still forces the calendar on an explicit booking ask", () => {
    expect(
      chooseForcedTool({
        valueFirst: true,
        hasSeenCalendar: false,
        priorMessages: [],
        message: "I want to book a call, how much is it?",
      }),
    ).toBe("show_booking_calendar");
  });

  const member = {
    role: "user" as const,
    content: "I'm an existing member and cannot log in to the portal",
    ts: "2026-09-23T00:00:00Z",
  };

  it("gives a support chat neither the calendar nor the cost video, on or off", () => {
    for (const valueFirst of [false, true]) {
      // Earlier message made it support: judged on the whole chat.
      expect(
        chooseForcedTool({
          valueFirst,
          hasSeenCalendar: false,
          priorMessages: [member],
          message: "how much is the renewal fee?",
        }),
      ).toBe(undefined);
      // A refund complaint mentioning a fee is not a cost question.
      expect(
        chooseForcedTool({
          valueFirst,
          hasSeenCalendar: false,
          priorMessages: [],
          message: "I want a refund, how much did I pay in fees",
        }),
      ).toBe(undefined);
    }
  });

  it("gives a member who plainly asks to book the calendar again", () => {
    expect(
      chooseForcedTool({
        valueFirst: true,
        hasSeenCalendar: false,
        priorMessages: [member],
        message: "ok, can I book a call",
      }),
    ).toBe("show_booking_calendar");
  });
});
