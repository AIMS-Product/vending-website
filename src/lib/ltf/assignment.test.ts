import { describe, expect, it } from "vitest";
import { isBotUserAgent, isGuideSwapLive } from "@/lib/ltf/assignment";

describe("isGuideSwapLive (swap switch)", () => {
  it("is closed in production unless explicitly on", () => {
    expect(isGuideSwapLive({ VERCEL_ENV: "production" })).toBe(false);
    expect(
      isGuideSwapLive({ VERCEL_ENV: "production", PLAYBOOK_GUIDE_LIVE: "off" }),
    ).toBe(false);
    expect(
      isGuideSwapLive({
        VERCEL_ENV: "production",
        PLAYBOOK_GUIDE_LIVE: "true",
      }),
    ).toBe(false);
    expect(
      isGuideSwapLive({ VERCEL_ENV: "production", PLAYBOOK_GUIDE_LIVE: "on" }),
    ).toBe(true);
  });

  it("is open on preview and next dev for testing", () => {
    expect(isGuideSwapLive({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isGuideSwapLive({ NODE_ENV: "development" })).toBe(true);
  });

  it("fails closed when nothing says otherwise", () => {
    expect(isGuideSwapLive({})).toBe(false);
    expect(isGuideSwapLive({ NODE_ENV: "production" })).toBe(false);
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
