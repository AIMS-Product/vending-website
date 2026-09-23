import { describe, expect, it } from "vitest";
import { runLearningEngine, type LearningConversationInput } from "./engine";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const TWO_DAYS_AGO = "2026-09-21T12:00:00.000Z";

function conversation(
  overrides: Partial<LearningConversationInput> & { said: string[] },
): LearningConversationInput {
  const { said, ...rest } = overrides;
  return {
    id: "c1",
    status: "lead_captured",
    createdAt: TWO_DAYS_AGO,
    lastMessageAt: TWO_DAYS_AGO,
    messages: said.map((content) => ({
      role: "user" as const,
      content,
      ts: TWO_DAYS_AGO,
    })),
    capturedName: "Pat",
    capturedEmail: "pat@example.com",
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
    booked: false,
    handedOff: false,
    ...rest,
  };
}

function drafts(conv: LearningConversationInput) {
  return runLearningEngine([conv], {
    now: NOW,
    bookingUrl: "https://example.com/book",
  }).followUpTasks;
}

describe("follow-up drafts", () => {
  it("drafts for an unbooked sales lead who went quiet", () => {
    const tasks = drafts(
      conversation({ said: ["how does it work", "can I book a call"] }),
    );
    expect(tasks.map((t) => t.taskType).sort()).toEqual([
      "general_follow_up",
      "invite_to_call",
    ]);
  });

  it("drafts nothing for someone whose call is booked", () => {
    expect(
      drafts(conversation({ said: ["can I book a call"], booked: true })),
    ).toEqual([]);
  });

  it("drafts nothing for a support chat", () => {
    expect(
      drafts(
        conversation({
          said: ["I want to cancel my membership", "talk to someone please"],
        }),
      ),
    ).toEqual([]);
  });

  it("drafts nothing for someone who says their call is already booked", () => {
    expect(
      drafts(conversation({ said: ["I need to cancel my call on Tuesday"] })),
    ).toEqual([]);
  });

  it("drafts nothing once the chat was handed to the team", () => {
    expect(
      drafts(conversation({ said: ["can I book a call"], handedOff: true })),
    ).toEqual([]);
  });

  it("does not read 'phone calls' as asking for a call", () => {
    const result = runLearningEngine(
      [
        conversation({
          said: ["do you handle the phone calls to locations for me?"],
        }),
      ],
      { now: NOW, bookingUrl: "https://example.com/book" },
    );
    expect(result.cases.map((c) => c.caseType)).not.toContain(
      "call_intent_no_booking",
    );
  });
});
