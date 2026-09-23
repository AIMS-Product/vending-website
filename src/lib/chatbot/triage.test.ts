import { describe, expect, it } from "vitest";
import { triageConversation, triageMessage } from "./triage";

describe("triageMessage", () => {
  it.each([
    "I can't log in to my account",
    "I cannot log into the portal",
    "how do I reset my password",
    "I forgot my password",
    "I want to cancel my subscription",
    "please cancel my membership",
    "how do I pause my membership",
    "I want a refund",
    "I'm requesting a refund",
    "can you refund my payment",
    "where is my refund",
    "I'm already a member, where are the videos",
    "I am an existing member",
    "I'm a current Vendingpreneurs member",
    "I was charged twice",
    "my Vendingpreneurs login stopped working",
    "question about my membership",
  ])("reads %j as support", (message) => {
    expect(triageMessage(message)).toBe("support");
  });

  it.each([
    "I need to cancel my call",
    "can I reschedule my appointment",
    "reschedule my call with you please",
    "I have a meeting on Tuesday",
    "I have a call scheduled for Thursday",
    "I already booked a call",
    "i'm already scheduled for thursday",
    "my call is tomorrow at 3",
  ])("reads %j as already booked", (message) => {
    expect(triageMessage(message)).toBe("booked_already");
  });

  it.each([
    // Prospects, taken from real phrasings that used to be misfiled.
    "Can I get a refund if it doesn't work out?",
    "Do you offer a full refund guarantee?",
    "do you offer a money back guarantee or refund policy?",
    "I have an existing customer base",
    "I'm already a member of your Facebook group",
    "I'm an existing client of a locator",
    "I'm a student in college, can I still do this?",
    "I'm a customer of Canteen already",
    "My problem is I don't have access to good locations",
    "I can't access much capital",
    "what's my account going to cost",
    "I got charged by another coach",
    "If I book, can I reschedule later?",
    "I had a call with a locator",
    "I have a call with my wife tonight",
    "I have a meeting with a location manager",
    "what if I want to cancel later, is there a contract?",
    "How much does it cost to start?",
    "How does the program work?",
    "can I talk to someone about phone calls with locations",
    "book a call",
    "I'm a teacher looking for side income",
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

  it("support wins over booked-already", () => {
    expect(
      triageConversation([
        user("I have a call on Tuesday"),
        assistant("Great."),
        user("also I can't log in to my account"),
      ]),
    ).toBe("support");
  });

  it("a later clear booking request turns it back into sales", () => {
    expect(
      triageConversation([
        user("I'm an existing member, I want to upgrade"),
        assistant("Happy to help."),
        user("yes let's book"),
      ]),
    ).toBe("sales");
    expect(
      triageConversation([
        user("I want a refund"),
        user("actually can I book a call to talk it through"),
      ]),
    ).toBe("sales");
  });

  it("asking for a person is not enough to leave support", () => {
    expect(
      triageConversation([
        user("I can't log in to my account"),
        user("can I talk to someone please"),
      ]),
    ).toBe("support");
  });

  it("support after a booking request is still support", () => {
    expect(
      triageConversation([
        user("book a call"),
        user("wait, I'm already a member and forgot my password"),
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
        user("can I reschedule my call if something comes up?"),
      ]),
    ).toBe("sales");
  });

  it("is sales for an empty or malformed transcript", () => {
    expect(triageConversation([])).toBe("sales");
    expect(triageConversation(null)).toBe("sales");
  });
});
