import { describe, expect, it, vi } from "vitest";
import {
  sanitizeDashes,
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

const evanCaseStudyResource: ChatbotResource = {
  key: "case_study:evan-tomahong",
  title: "Evan Tomahong: 40 machines in 18 months",
  blurb: "Was a line cook before starting a route.",
  url: "/case-studies/evan-tomahong",
};

const teacherProfile = {
  name: "Jordan Rivera",
  email: null,
  phone: null,
  current_work: "teaching high school",
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

  it("sends both text and html for every lead-facing resource email", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(baseInput, DEFAULT_CHATBOT_CONFIG, {
      fetchImpl,
    });
    expect(typeof calls[0].body.text).toBe("string");
    expect(typeof calls[0].body.html).toBe("string");
    expect(calls[0].body.html as string).toContain("<html>");
    expect(calls[0].body.html as string).toContain("max-width:560px");
  });

  it("greets by first name when visitorName is set, and falls back to profile.name, then to a plain 'Hey,'", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(
      { ...baseInput, visitorName: "Jordan Rivera" },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl },
    );
    expect(calls[0].body.text as string).toMatch(/^Hey Jordan,/);

    const { calls: calls2, fetchImpl: fetchImpl2 } = captureFetch();
    await sendChatbotResourceEmail(
      { ...baseInput, visitorName: null, profile: teacherProfile },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl: fetchImpl2 },
    );
    expect(calls2[0].body.text as string).toMatch(/^Hey Jordan,/);

    const { calls: calls3, fetchImpl: fetchImpl3 } = captureFetch();
    await sendChatbotResourceEmail(
      { ...baseInput, visitorName: null, profile: null },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl: fetchImpl3 },
    );
    expect(calls3[0].body.text as string).toMatch(/^Hey,/);
  });

  it("gives a single case-study send Mia's personal subject and a story link, never a bare em/en dash", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(
      {
        ...baseInput,
        resources: [evanCaseStudyResource],
        profile: teacherProfile,
      },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl },
    );
    const { subject, text, html } = calls[0].body as {
      subject: string;
      text: string;
      html: string;
    };
    expect(subject).toBe("The member story I mentioned");
    // The opener never fabricates a similarity: without a model-authored
    // connection sentence it stays neutral.
    expect(text).toContain("Here's the story I mentioned in chat.");
    expect(text).toContain(
      "https://www.vendingpreneurs.com/case-studies/evan-tomahong",
    );
    expect(html).toContain(">Read Evan&#39;s story<");
    for (const value of [subject, text, html]) {
      expect(value).not.toMatch(/[—–]/);
    }
  });

  it("uses the model-authored connection sentence as the case-study opener when provided", async () => {
    resetMockConfig();
    const { calls, fetchImpl } = captureFetch();
    await sendChatbotResourceEmail(
      {
        ...baseInput,
        resources: [evanCaseStudyResource],
        connection:
          "You said you want something outside teaching hours, and Evan built his route in the evenings.",
      },
      DEFAULT_CHATBOT_CONFIG,
      { fetchImpl },
    );
    const text = calls[0].body.text as string;
    expect(text).toContain("Evan built his route in the evenings");
    expect(text).not.toContain("Here's the story I mentioned in chat.");
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
    expect(calls[0].body.subject).toBe("Chatbot lead: Jordan, wants a call");
  });
});

describe("sanitizeDashes", () => {
  it("turns a spaced em or en dash into a comma", () => {
    expect(sanitizeDashes("Evan Tomahong — 40 machines in 18 months")).toBe(
      "Evan Tomahong, 40 machines in 18 months",
    );
    expect(sanitizeDashes("Chatbot catch-up – 3 to review")).toBe(
      "Chatbot catch-up, 3 to review",
    );
  });

  it("turns an unspaced dash (a number range) into a plain hyphen", () => {
    expect(sanitizeDashes("20–30 machines")).toBe("20-30 machines");
  });

  it("leaves text without an em/en dash untouched", () => {
    expect(sanitizeDashes("Hey Jordan, here's what I promised.")).toBe(
      "Hey Jordan, here's what I promised.",
    );
  });
});
