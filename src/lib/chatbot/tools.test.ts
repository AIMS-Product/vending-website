import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CHATBOT_CONFIG } from "./config";
import type { ChatbotMessage } from "./conversation-store";
import { runChatbotTool, type ChatbotToolContext } from "./tools";
import type { Database } from "@/types/database";

type ToolClient = Pick<SupabaseClient<Database>, "from">;

const noopClient = {
  from() {
    return {
      upsert: () => Promise.resolve({ error: null }),
    };
  },
} as unknown as ToolClient;

function makeContext(
  overrides: Partial<ChatbotToolContext> = {},
): ChatbotToolContext {
  return {
    conversationId: "conv-1",
    personaName: "Mia",
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    transcript: [],
    embedDomain: "www.vendingpreneurs.com",
    config: DEFAULT_CHATBOT_CONFIG,
    client: noopClient,
    ...overrides,
  };
}

function calendarMessage(): ChatbotMessage {
  return {
    role: "assistant",
    content: "Opened the booking calendar in the chat.",
    ts: "2026-08-21T00:00:00.000Z",
    kind: "calendar",
    data: { url: "https://calendly.com/x" },
  };
}

function resourceMessage(): ChatbotMessage {
  return {
    role: "assistant",
    content: "Emailed the roadmap.",
    ts: "2026-08-21T00:00:00.000Z",
    kind: "resource_card",
    data: { email: "dana@example.com", resources: [] },
  };
}

describe("show_booking_calendar", () => {
  it("emits a calendar message tagged with the conversation id", async () => {
    const outcome = await runChatbotTool(
      "show_booking_calendar",
      "{}",
      makeContext(),
    );

    expect(outcome.message?.kind).toBe("calendar");
    const url = new URL(String(outcome.message?.data?.url));
    expect(url.searchParams.get("utm_content")).toBe("conv-1");
    expect(url.searchParams.get("embed_type")).toBe("Inline");
  });

  it("refuses to open a second calendar in the same conversation", async () => {
    const outcome = await runChatbotTool(
      "show_booking_calendar",
      "{}",
      makeContext({ transcript: [calendarMessage()] }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("already open");
  });
});

describe("capture_contact", () => {
  it("records details the visitor actually gave", async () => {
    const outcome = await runChatbotTool(
      "capture_contact",
      JSON.stringify({ name: " Dana ", email: "dana@example.com" }),
      makeContext(),
    );

    expect(outcome.capture).toEqual({
      name: "Dana",
      email: "dana@example.com",
      phone: null,
    });
  });

  it("drops a value the model made up rather than trusting it", async () => {
    // The model is a lossy narrator: anything it reports is re-validated
    // through extractLead before it can reach the CRM.
    const outcome = await runChatbotTool(
      "capture_contact",
      JSON.stringify({ email: "not-an-address" }),
      makeContext(),
    );

    expect(outcome.capture).toBeUndefined();
    expect(outcome.result).toContain("Nothing usable");
  });
});

describe("send_resources_email", () => {
  it("refuses to send before an email has been captured", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext(),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("No email on file");
  });

  it("stops at two resource emails per conversation", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext({
        capturedEmail: "dana@example.com",
        transcript: [resourceMessage(), resourceMessage()],
      }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("already been emailed twice");
  });

  it("rejects resource keys that are not in the catalog", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["free-machines", "case_study:nobody"] }),
      makeContext({ capturedEmail: "dana@example.com" }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("None of those resource keys exist");
  });
});

describe("runChatbotTool", () => {
  it("survives malformed arguments and unknown tool names", async () => {
    const malformed = await runChatbotTool(
      "capture_contact",
      "{not json",
      makeContext(),
    );
    const unknown = await runChatbotTool(
      "delete_everything",
      "{}",
      makeContext(),
    );

    expect(malformed.result).toContain("malformed");
    expect(unknown.result).toContain("Unknown tool");
  });
});
