import { describe, expect, it } from "vitest";
import { triageConversation, triageMessage } from "./triage";

describe("triageMessage", () => {
  it.each([
    "I can't log in to my account",
    "how do I reset my password",
    "I want to cancel my subscription",
    "please cancel my membership",
    "I want a refund",
    "can I get my refund",
    "I'm already a member, where are the videos",
    "I am an existing member",
    "I was charged twice",
    "how do I pause my membership",
  ])("reads %j as support", (message) => {
    expect(triageMessage(message)).toBe("support");
  });

  it.each([
    "I need to cancel my call",
    "can I reschedule my appointment",
    "I have a meeting on Tuesday",
    "I already booked a call",
    "i'm already scheduled for thursday",
    "my call is tomorrow at 3",
  ])("reads %j as already booked", (message) => {
    expect(triageMessage(message)).toBe("booked_already");
  });

  it.each([
    "How much does it cost to start?",
    "How does the program work?",
    "do you offer a money back guarantee or refund policy?",
    "can I talk to someone about phone calls with locations",
    "book a call",
    "I'm a teacher looking for side income",
    "what if I want to cancel later, is there a contract?",
  ])("keeps %j as sales", (message) => {
    expect(triageMessage(message)).toBe("sales");
  });
});

describe("triageConversation", () => {
  const user = (content: string, kind?: "booking_confirmed") => ({
    role: "user" as const,
    content,
    kind,
  });
  const assistant = (content: string, kind?: "booking_confirmed") => ({
    role: "assistant" as const,
    content,
    kind,
  });

  it("support wins over booked-already anywhere before a booking", () => {
    expect(
      triageConversation([
        user("I have a call on Tuesday"),
        assistant("Great."),
        user("also I can't log in to my account"),
      ]),
    ).toBe("support");
  });

  it("reads the visitor only, never the bot", () => {
    expect(
      triageConversation([
        user("how does it work"),
        assistant("If you are an existing member, email support."),
      ]),
    ).toBe("sales");
  });

  it("ignores what a visitor says after booking in the chat", () => {
    expect(
      triageConversation([
        user("how much does it cost"),
        assistant("Booked for Thursday.", "booking_confirmed"),
        user("can I reschedule if something comes up?"),
      ]),
    ).toBe("sales");
  });

  it("is sales for an empty or malformed transcript", () => {
    expect(triageConversation([])).toBe("sales");
    expect(triageConversation(null)).toBe("sales");
  });
});
