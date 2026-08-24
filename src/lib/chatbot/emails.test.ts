import { describe, expect, it, vi } from "vitest";
import {
  sendChatbotProfileEmail,
  sendChatbotResourceEmail,
  type ChatbotProfileEmailInput,
  type ChatbotResourceEmailInput,
} from "./emails";
import { DEFAULT_CHATBOT_CONFIG, type ChatbotConfig } from "./config";
import type { ChatbotResource } from "./resources";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    RESEND_API_KEY: "re_test_key" as string | undefined,
    LEAD_NOTIFICATION_FROM: undefined as string | undefined,
    RESEND_FROM_EMAIL: undefined as string | undefined,
    LEAD_NOTIFICATION_TO: undefined as string | undefined,
  },
}));

vi.mock("@/lib/config", () => ({
  config: mockConfig,
  publicConfig: { siteUrl: "https://www.vendingpreneurs.com" },
}));

function resetMockConfig() {
  mockConfig.RESEND_API_KEY = "re_test_key";
  mockConfig.LEAD_NOTIFICATION_FROM = undefined;
  mockConfig.RESEND_FROM_EMAIL = undefined;
  mockConfig.LEAD_NOTIFICATION_TO = undefined;
}

const routedConfig: ChatbotConfig = {
  ...DEFAULT_CHATBOT_CONFIG,
  leadRoutingEmails: "sales@example.com",
};

const roadmapResource: ChatbotResource = {
  key: "roadmap",
  title: "The 90-Day Vending Route Roadmap",
  blurb: "The free 90-day plan.",
  url: "/resources/roadmap",
};

/** Captures the exact Resend payload each test sends, without a real network call. */
function captureFetch() {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      body: init?.body ? JSON.parse(init.body as string) : {},
    });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("sendChatbotResourceEmail", () => {
  const baseInput: ChatbotResourceEmailInput = {
    to: "visitor@example.com",
    visitorName: "Jordan",
    personaName: "Mia",
    resources: [roadmapResource],
    bookingUrl: "https://calendly.com/d/abc/vending-accelerator-call",
    profile: null,
  };

  it("skips without hitting the network when the recipient is empty", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    const result = await sendChatbotResourceEmail(
      { ...baseInput, to: "  " },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl },
    );
    expect(result).toEqual({ ok: false, error: "No recipient email." });
    expect(calls).toHaveLength(0);
  });

  it("fails without hitting the network when RESEND_API_KEY is unset", async () => {
    resetMockConfig();
    mockConfig.RESEND_API_KEY = undefined;
    const { calls, fetchImpl } = captureFetch();
    const result = await sendChatbotResourceEmail(
      baseInput,
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl },
    );
    expect(result).toEqual({ ok: false, error: "Resend isn't configured." });
    expect(calls).toHaveLength(0);
  });

  it("uses LEAD_NOTIFICATION_FROM first in the from-address chain", async () => {
    resetMockConfig();
    mockConfig.LEAD_NOTIFICATION_FROM =
      "Vendingpreneurs <leads@vendingpreneurs.com>";
    mockConfig.RESEND_FROM_EMAIL = "fallback@vendingpreneurs.com";
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, DEFAULT_CHATBOT_CONFIG, {
      fetchImpl,
    });
    expect(calls[0].body.from).toBe(
      "Mia at Vendingpreneurs <leads@vendingpreneurs.com>",
    );
  });

  it("falls back to RESEND_FROM_EMAIL when LEAD_NOTIFICATION_FROM is unset", async () => {
    resetMockConfig();
    mockConfig.RESEND_FROM_EMAIL = "fallback@vendingpreneurs.com";
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, DEFAULT_CHATBOT_CONFIG, {
      fetchImpl,
    });
    expect(calls[0].body.from).toBe(
      "Mia at Vendingpreneurs <fallback@vendingpreneurs.com>",
    );
  });

  it("falls back to the hardcoded default when neither from-address env var is set", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, DEFAULT_CHATBOT_CONFIG, {
      fetchImpl,
    });
    expect(calls[0].body.from).toBe(
      "Mia at Vendingpreneurs <hello@vendingpreneurs.com>",
    );
  });

  it("defaults reply-to to the from-address when no team routing emails are configured", async () => {
    resetMockConfig();
    mockConfig.LEAD_NOTIFICATION_FROM =
      "Vendingpreneurs <leads@vendingpreneurs.com>";
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, DEFAULT_CHATBOT_CONFIG, {
      fetchImpl,
    });
    expect(calls[0].body.reply_to).toEqual(["leads@vendingpreneurs.com"]);
  });

  it("prefers the team routing emails as reply-to when configured", async () => {
    resetMockConfig();
    mockConfig.LEAD_NOTIFICATION_FROM =
      "Vendingpreneurs <leads@vendingpreneurs.com>";
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, routedConfig, { fetchImpl });
    expect(calls[0].body.reply_to).toEqual(["sales@example.com"]);
  });

  it("references current_work in the opener when the profile has it", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(
      {
        ...baseInput,
        profile: {
          name: null,
          email: null,
          phone: null,
          current_work: "Managing a retail store",
          capital_signal: null,
          timeline: null,
          state_or_market: null,
          motivation: null,
          objections: [],
          resources_wanted: [],
          call_intent: false,
          sentiment: null,
          follow_up_needed: false,
          summary: null,
        },
      },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl },
    );
    expect(calls[0].body.text as string).toContain(
      "Following up on what you shared about managing a retail store, here's what I promised.",
    );
  });

  it("uses an absolute resource URL and a plain opener when no profile is available", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, DEFAULT_CHATBOT_CONFIG, {
      fetchImpl,
    });
    const text = calls[0].body.text as string;
    expect(text).toContain("Here's what I promised.");
    expect(text).toContain("https://www.vendingpreneurs.com/resources/roadmap");
    expect(text).not.toContain("—");
    expect(text).toContain("Mia\nVendingpreneurs");
  });
});

describe("sendChatbotProfileEmail", () => {
  const baseInput: ChatbotProfileEmailInput = {
    conversationId: "conv-1",
    capturedName: "Jordan",
    capturedEmail: "jordan@example.com",
    capturedPhone: null,
    profile: null,
  };

  it("skips without hitting the network when no contact was captured", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    const result = await sendChatbotProfileEmail(
      { ...baseInput, capturedEmail: null, capturedPhone: null },
      routedConfig,
      { fetchImpl },
    );
    expect(result).toEqual({ ok: false, error: "No contact captured." });
    expect(calls).toHaveLength(0);
  });

  it("puts call intent right after contact fields, ahead of capital/timeline/motivation/summary", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotProfileEmail(
      {
        ...baseInput,
        profile: {
          name: null,
          email: null,
          phone: null,
          current_work: "Warehouse supervisor",
          capital_signal: "Has $20k saved",
          timeline: "30 days",
          state_or_market: "Texas",
          motivation: "Wants to leave the 9-5",
          objections: [],
          resources_wanted: [],
          call_intent: true,
          sentiment: "Excited",
          follow_up_needed: true,
          summary: "Ready to move fast.",
        },
      },
      routedConfig,
      { fetchImpl },
    );
    const text = calls[0].body.text as string;
    const order = [
      "Email: jordan@example.com",
      "Call intent: Yes",
      "Capital signal: Has $20k saved",
      "Timeline: 30 days",
      "Motivation: Wants to leave the 9-5",
      "Summary: Ready to move fast.",
      "Full transcript:",
    ].map((needle) => text.indexOf(needle));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(calls[0].body.subject).toBe("Chatbot lead: Jordan — wants a call");
  });
});
