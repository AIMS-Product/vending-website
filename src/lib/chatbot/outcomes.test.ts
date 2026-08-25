import { describe, expect, it } from "vitest";
import {
  askedAboutCost,
  calendarWasShown,
  deriveConversationOutcome,
  openingQuestion,
  type OutcomeInput,
} from "@/lib/chatbot/outcomes";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const RECENT = "2026-08-25T11:55:00.000Z";
const STALE = "2026-08-25T10:00:00.000Z";

function conversation(overrides: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    messages: [
      { role: "user", content: "How much does it cost to start?", ts: STALE },
      { role: "assistant", content: "Grab a time.", ts: STALE },
    ],
    capturedEmail: null,
    capturedPhone: null,
    callBookedAt: null,
    lastMessageAt: STALE,
    createdAt: STALE,
    ...overrides,
  };
}

const withCalendar = [
  { role: "user", content: "How much does it cost?", ts: STALE },
  {
    role: "assistant",
    content: "Opened the booking calendar in the chat.",
    ts: STALE,
    kind: "calendar",
  },
];

describe("deriveConversationOutcome", () => {
  it("a booking beats every other signal", () => {
    expect(
      deriveConversationOutcome(
        conversation({ callBookedAt: STALE, capturedEmail: "a@b.com" }),
        NOW,
      ),
    ).toBe("booked");
  });

  it("captured contact with no booking stays recoverable", () => {
    expect(
      deriveConversationOutcome(
        conversation({ capturedEmail: "a@b.com" }),
        NOW,
      ),
    ).toBe("captured_no_booking");
  });

  it("counts a phone-only capture as captured", () => {
    expect(
      deriveConversationOutcome(conversation({ capturedPhone: "5555555555" }), NOW),
    ).toBe("captured_no_booking");
  });

  it("is still open while the chat is recent", () => {
    expect(
      deriveConversationOutcome(
        conversation({ messages: withCalendar, lastMessageAt: RECENT }),
        NOW,
      ),
    ).toBe("open");
  });

  it("flags a shown-then-abandoned calendar once the chat goes quiet", () => {
    expect(
      deriveConversationOutcome(conversation({ messages: withCalendar }), NOW),
    ).toBe("calendar_abandoned");
  });

  it("flags a quiet chat that never saw a calendar as lost", () => {
    expect(deriveConversationOutcome(conversation(), NOW)).toBe(
      "left_no_contact",
    );
  });

  it("falls back to created_at when no message timestamp exists", () => {
    expect(
      deriveConversationOutcome(
        conversation({ lastMessageAt: null, createdAt: STALE }),
        NOW,
      ),
    ).toBe("left_no_contact");
  });

  it("treats an unparseable timestamp as still open rather than lost", () => {
    expect(
      deriveConversationOutcome(
        conversation({ lastMessageAt: "not a date" }),
        NOW,
      ),
    ).toBe("open");
  });

  it("tolerates a non-array messages payload", () => {
    expect(
      deriveConversationOutcome(conversation({ messages: null }), NOW),
    ).toBe("left_no_contact");
  });
});

describe("transcript readers", () => {
  it("detects the calendar card", () => {
    expect(calendarWasShown(withCalendar)).toBe(true);
    expect(calendarWasShown(conversation().messages)).toBe(false);
  });

  it("detects a cost question from the visitor only", () => {
    expect(askedAboutCost(conversation().messages)).toBe(true);
    expect(
      askedAboutCost([
        { role: "assistant", content: "How much does it cost?", ts: STALE },
      ]),
    ).toBe(false);
  });

  it("does not count an earnings question as a cost question", () => {
    expect(
      askedAboutCost([
        { role: "user", content: "How much can I make a month?", ts: STALE },
      ]),
    ).toBe(false);
  });

  it("reads the opening question", () => {
    expect(openingQuestion(conversation().messages)).toBe(
      "How much does it cost to start?",
    );
    expect(openingQuestion([])).toBeNull();
  });
});
