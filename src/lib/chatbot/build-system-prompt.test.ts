import { describe, expect, it } from "vitest";
import { buildChatbotSystemPrompt } from "@/lib/chatbot/build-system-prompt";
import { findPriceLeak } from "@/lib/chatbot/price-guard";
import { SITE_KNOWLEDGE_BLOCK } from "@/lib/chatbot/site-knowledge";

const base = {
  personaName: "Mia",
  knowledgeBase: null,
  userTurnCount: 3,
};

describe("the prompt never feeds the model a price", () => {
  // The regression that started all of this: PROGRAM_FACTS said "$1,500-$5,000
  // a month in revenue per member", and the bot read it back to a real lead as
  // "members typically spend around $1,500 to $5,000 to get started".
  it("has no trace of the figure the bot quoted", () => {
    expect(SITE_KNOWLEDGE_BLOCK).not.toContain("1,500");
    expect(SITE_KNOWLEDGE_BLOCK).not.toContain("5,000");
  });

  // Turning the output guard on the prompt itself: if a future edit adds a
  // dollar amount next to cost language anywhere in the static knowledge, the
  // same detector that watches the model's replies fails this test first.
  it("contains no cost-shaped dollar figure", () => {
    expect(findPriceLeak(SITE_KNOWLEDGE_BLOCK)).toBeNull();
  });

  it("still carries the member results the testimonial matching needs", () => {
    expect(SITE_KNOWLEDGE_BLOCK).toContain("CASE STUDY INDEX");
    expect(SITE_KNOWLEDGE_BLOCK).toMatch(/\$\d/);
  });

  it("keeps the setup cost stat out of the case study index", () => {
    // shan-25k-per-month.json carries a "Setup Cost" stat of $10-12K. It is a
    // real member's number and belongs on the case study page, but a bot that
    // restates it as the program's price is the whole bug.
    expect(SITE_KNOWLEDGE_BLOCK).not.toContain("setup cost");
    const shanLine = SITE_KNOWLEDGE_BLOCK.split("\n").find((line) =>
      line.startsWith("- Shan"),
    );
    expect(shanLine).toBeDefined();
    expect(shanLine).toContain("monthly revenue");
    expect(shanLine).not.toContain("10-12K");
    // Madison's $10-12K is her MONTHLY REVENUE and belongs in the index, so
    // this is a per-member assertion rather than a blanket string ban.
    expect(SITE_KNOWLEDGE_BLOCK).toContain("- Madison");
  });

  it.each(["A", "B", "C"])(
    "states the absolute pricing rule on a turn that resolves to branch %s",
    () => {
      const prompt = buildChatbotSystemPrompt({
        ...base,
        userTurnCount: 1,
        capturedEmail: "someone@example.com",
      });
      expect(prompt).toContain("PRICING (absolute");
      expect(prompt).toContain("NEVER STATE A PRICE");
      expect(prompt).toContain("financing partners");
    },
  );
});

describe("closing a booking", () => {
  it("always tells the model to name a specific slot", () => {
    const prompt = buildChatbotSystemPrompt(base);
    expect(prompt).toContain("CLOSING A BOOKING");
    expect(prompt).toContain("grab the first morning slot on there");
    // Mia has no availability data, so a named clock time would be the same
    // invent-a-fact failure as the price. Concrete, but never a specific hour
    // the visitor did not say first.
    expect(prompt).toContain("ONLY source of a clock time you may say");
  });

  it("asks on the visitor's first message after the calendar appeared", () => {
    const prompt = buildChatbotSystemPrompt({
      ...base,
      hasSeenCalendar: true,
      userTurnsSinceCalendar: 0,
    });
    expect(prompt).toContain("find a time that works");
  });

  it.each([1, 2, 5])("does not ask again on later turns (%i)", (turns) => {
    const prompt = buildChatbotSystemPrompt({
      ...base,
      hasSeenCalendar: true,
      userTurnsSinceCalendar: turns,
    });
    expect(prompt).not.toContain("find a time that works");
  });

  it("never asks once a booking is confirmed", () => {
    const prompt = buildChatbotSystemPrompt({
      ...base,
      hasSeenCalendar: true,
      userTurnsSinceCalendar: 0,
      hasConfirmedBooking: true,
    });
    expect(prompt).not.toContain("find a time that works");
  });

  it("says nothing about an open calendar when none has been shown", () => {
    const prompt = buildChatbotSystemPrompt(base);
    expect(prompt).not.toContain("find a time that works");
  });
});

describe("the pricing rule does not gag earnings answers", () => {
  // Live on production the first version of this rule made Mia answer "how
  // much can I make?" with "I can't share specific numbers on earnings" and
  // then the plans-and-financing line. Member results are the proof that sells
  // the call; refusing to cite them is worse than the bug being fixed.
  it("says plainly that the rule is about cost, not earnings", () => {
    const prompt = buildChatbotSystemPrompt(base);
    expect(prompt).toContain("ONLY about what the visitor would PAY us");
    expect(prompt).toContain("is an earnings question");
  });

  it("does not claim to override every other instruction", () => {
    // It used to, which is how it outranked TESTIMONIAL MATCHING.
    expect(buildChatbotSystemPrompt(base)).not.toContain(
      "overrides every other instruction",
    );
  });

  it("still keeps the mandatory member-story rule intact", () => {
    const prompt = buildChatbotSystemPrompt(base);
    expect(prompt).toContain("TESTIMONIAL MATCHING");
    expect(prompt).toContain("a story with no link is a failure");
  });
});

describe("the visitor's name", () => {
  it("asks for the first name early when none is known", () => {
    const prompt = buildChatbotSystemPrompt(base);
    expect(prompt).toContain("You do not know their name yet");
    expect(prompt).toContain("first or second reply");
    expect(prompt).toContain("Who do I have the pleasure of speaking with?");
    expect(prompt).toContain('Never "what should I call you"');
  });

  it("uses a known first name naturally and never asks again", () => {
    const prompt = buildChatbotSystemPrompt({
      ...base,
      capturedName: "Jordan Lee",
    });
    expect(prompt).toContain("You are talking with Jordan.");
    expect(prompt).toContain("Jordan, want to just grab a time right here?");
    expect(prompt).toContain("Never ask for their name again");
    expect(prompt).not.toContain("You do not know their name yet");
  });
});

describe("the call is with a vending consultant, never a sales team", () => {
  it("tells the model the vocabulary and the escalation for repeated cost pushes", () => {
    const prompt = buildChatbotSystemPrompt(base);
    expect(prompt).toContain("Never call them a sales team");
    expect(prompt).toContain("never open the calendar twice in a row");
    expect(prompt).toContain("Offer the finance templates by name");
  });
});
