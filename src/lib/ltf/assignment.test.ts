import { describe, expect, it } from "vitest";
import {
  isBotUserAgent,
  isLtfTestOpen,
  pickVariant,
} from "@/lib/ltf/assignment";

describe("isLtfTestOpen (launch switch)", () => {
  it("is closed in production unless explicitly on", () => {
    expect(isLtfTestOpen({ VERCEL_ENV: "production" })).toBe(false);
    expect(
      isLtfTestOpen({ VERCEL_ENV: "production", PLAYBOOK_PDF_TEST: "off" }),
    ).toBe(false);
    expect(
      isLtfTestOpen({ VERCEL_ENV: "production", PLAYBOOK_PDF_TEST: "true" }),
    ).toBe(false);
    expect(
      isLtfTestOpen({ VERCEL_ENV: "production", PLAYBOOK_PDF_TEST: "on" }),
    ).toBe(true);
  });

  it("is open on preview and next dev for testing", () => {
    expect(isLtfTestOpen({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isLtfTestOpen({ NODE_ENV: "development" })).toBe(true);
  });

  it("fails closed when nothing says otherwise", () => {
    expect(isLtfTestOpen({})).toBe(false);
    expect(isLtfTestOpen({ NODE_ENV: "production" })).toBe(false);
  });
});

describe("pickVariant", () => {
  it("maps the coin flip to a and b", () => {
    expect(pickVariant(0)).toBe("a");
    expect(pickVariant(1)).toBe("b");
  });

  it("splits roughly 50/50", () => {
    const rolls = Array.from({ length: 4000 }, () => pickVariant());
    const a = rolls.filter((v) => v === "a").length;
    expect(a).toBeGreaterThan(1800);
    expect(a).toBeLessThan(2200);
  });
});

describe("isBotUserAgent", () => {
  it("flags unfurlers and scripts, not browsers", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isBotUserAgent("curl/8.4.0")).toBe(true);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });
});
