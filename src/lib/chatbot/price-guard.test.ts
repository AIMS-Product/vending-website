import { describe, expect, it } from "vitest";
import {
  findPriceLeak,
  findPriceLeakInReplies,
} from "@/lib/chatbot/price-guard";

describe("findPriceLeak", () => {
  it("catches the reply that actually shipped to a real lead", () => {
    const leak = findPriceLeak(
      "The costs can vary depending on factors like the type of machines you choose and where you want to place them. You'll find that members typically spend around $1,500 to $5,000 to get started, which covers the machines and initial product inventory.",
    );
    expect(leak?.amount).toBe("$1,500");
  });

  it.each([
    ["it costs about $2,500 upfront", "$2,500"],
    ["the investment starts at $10k", "$10k"],
    ["most people pay 3000 dollars to get going", "3000 dollars"],
    ["budget roughly USD 4000 for machines", "USD 4000"],
    ["there's a $500 deposit", "$500"],
    ["financing usually lands around $1.5k a pop", "$1.5k"],
  ])("flags %j", (text, amount) => {
    expect(findPriceLeak(text)?.amount).toBe(amount);
  });

  it.each([
    // Member results are the proof engine of this chat. Every one of these
    // pairs a dollar figure with words the cost matcher also looks for, and
    // none of them is a price.
    "one of our members, Shan, does $25K/mo and started with no experience",
    "Andy Kunselman was a corporate retail exec and now pulls $10K/mo from 2 locations",
    "Mallorie is a PA making $4K a month on the side since she started",
    "Michael D is at $600K/yr",
    "the community has done $3 million+ in vending sales",
    "Lane went from mine geologist to $200K per year",
    "her best month was $18,000 in revenue",
  ])("does not flag member revenue: %j", (text) => {
    expect(findPriceLeak(text)).toBeNull();
  });

  it.each([
    // Bare numbers are years, machine counts and location counts far more
    // often than money, so they are deliberately out of scope.
    "we've placed 3,000 locations",
    "there are 850 members",
    "most people place a machine in under 30 days",
    "it takes 10-15 hours a week",
  ])("ignores bare numbers: %j", (text) => {
    expect(findPriceLeak(text)).toBeNull();
  });

  it("is null for the answer the bot is supposed to give", () => {
    expect(
      findPriceLeak(
        "We've got a few different plans and work with a lot of financing partners, so the best way to find the one that fits your goals is a quick chat with the team. Grab the 9am if mornings work for you.",
      ),
    ).toBeNull();
  });

  it("returns the surrounding context for the flag note", () => {
    const leak = findPriceLeak("Startup cost is around $7,500 all in.");
    expect(leak?.context).toContain("$7,500");
  });

  it("is null on empty input", () => {
    expect(findPriceLeak("")).toBeNull();
  });

  it("reports one leak per turn, not one per sentence", () => {
    const leak = findPriceLeakInReplies([
      "Happy to help.",
      "It costs about $2,000 upfront.",
      "And then another $500 in fees.",
    ]);
    expect(leak?.amount).toBe("$2,000");
  });

  it("returns null when no reply in the turn leaked", () => {
    expect(
      findPriceLeakInReplies(["Happy to help.", "What do you do for work?"]),
    ).toBeNull();
  });
});
