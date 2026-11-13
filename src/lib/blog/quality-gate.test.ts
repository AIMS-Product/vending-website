import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkPost, factualNumbers, hasKeyword } from "./quality-gate";

const raw = readFileSync(path.join(__dirname, "__fixtures__/best-vending-locations-v2.md"), "utf8");
const markdown = `# Best Vending Machine Locations: 10 Types Ranked\n\n${raw}`;
const base = {
  markdown,
  keyword: "vending machine locations",
  seoTitle: "Best Vending Machine Locations: 10 Types Ranked + Chart",
  metaDescription:
    "The 10 best vending machine locations, ranked with a location chart, quick picks, and real member routes for each location type.",
};

describe("checkPost on the hand-built locations draft", () => {
  it("reads its tables, cards and bold-question FAQ", () => {
    const r = checkPost({ ...base, groundingText: raw });
    expect(r.stats.tables).toBeGreaterThanOrEqual(2);
    expect(r.stats.h3).toBeGreaterThanOrEqual(10);
    expect(r.stats.faqQuestions).toBeGreaterThanOrEqual(4);
    expect(r.stats.internalLinks).toBeGreaterThanOrEqual(5);
  });

  it("flags figures the source data does not back", () => {
    const r = checkPost({ ...base, groundingText: "" });
    expect(r.failures.join("\n")).toMatch(/numbers not in the source data: .*\$80,000/);
  });

  it("flags AI tells", () => {
    const r = checkPost({ ...base, groundingText: raw, markdown: `${markdown}\nIn today's market, it's not a machine, it's a store.` });
    const all = r.failures.join("\n");
    expect(all).toMatch(/in today's/);
    expect(all).toMatch(/it's not X, it's Y/);
  });
});

describe("factualNumbers", () => {
  it("keeps facts and skips list digits and years", () => {
    expect(factualNumbers("Step 3 in 2026: 245 bottles, $5,000, 12%")).toEqual(["245", "$5,000", "12%"]);
  });
});

describe("hasKeyword", () => {
  it("accepts the keyword verbatim or in a natural form with every word", () => {
    expect(hasKeyword("Vending Businesses for Sale: a guide", "vending business sale")).toBe(true);
    expect(hasKeyword("Buying a Vending Route", "buy a vending route")).toBe(false);
    expect(hasKeyword("How to buy a vending route", "buy a vending route")).toBe(true);
  });
});
