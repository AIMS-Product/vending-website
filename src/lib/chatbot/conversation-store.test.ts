import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  persistConversationTurn,
  type ChatbotConversation,
} from "./conversation-store";
import type { Database } from "@/types/database";

type PersistClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Only exercises `.from("chatbot_conversations").update(patch).eq(id)` —
 * the one call this function makes — and records the raw patch object so
 * tests can assert exactly which keys were (and were not) included.
 */
function fakeClient() {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table !== "chatbot_conversations") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  } as unknown as PersistClient;
  return { updates, client };
}

function makeConversation(
  overrides: Partial<ChatbotConversation> = {},
): ChatbotConversation {
  return {
    id: "conv-1",
    session_id: "session-1",
    visitor_hash: null,
    status: "active",
    messages: [],
    captured_name: null,
    captured_email: null,
    captured_phone: null,
    prospect_profile: null,
    prospect_profile_emailed_at: null,
    attribution_source: null,
    lead_submission_id: null,
    call_booked_at: null,
    booked_event_uri: null,
    message_count: 0,
    last_message_at: "2026-08-01T00:00:00.000Z",
    handed_off_at: null,
    handoff_reason: null,
    page_url: "/start",
    user_agent: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const now = () => new Date("2026-08-01T00:05:00.000Z");

describe("persistConversationTurn", () => {
  it("never overwrites a captured field with null from a stale snapshot", async () => {
    // The in-memory `conversation` was read before a concurrent request
    // (e.g. the capture-card submit) wrote a real email — this turn itself
    // captured nothing, so the write must leave the column untouched
    // rather than falling back to the stale (null) snapshot value.
    const fake = fakeClient();
    const conversation = makeConversation({ captured_email: null });

    await persistConversationTurn(
      conversation,
      { messages: [], capturedEmail: null, capturedPhone: null },
      { client: fake.client, now },
    );

    expect(fake.updates[0]).not.toHaveProperty("captured_email");
    expect(fake.updates[0]).not.toHaveProperty("captured_phone");
  });

  it("writes a captured field when this turn's value is truthy", async () => {
    const fake = fakeClient();
    const conversation = makeConversation();

    await persistConversationTurn(
      conversation,
      { messages: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );

    expect(fake.updates[0]?.captured_email).toBe("jane@example.com");
  });

  it("upgrades active to lead_captured when this turn captures contact info", async () => {
    const fake = fakeClient();
    const conversation = makeConversation({ status: "active" });

    await persistConversationTurn(
      conversation,
      { messages: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );

    expect(fake.updates[0]?.status).toBe("lead_captured");
  });

  it("never downgrades or otherwise rewrites status from this write", async () => {
    const fake = fakeClient();

    // No capture this turn: active stays untouched by this write (not
    // force-set back to "active").
    await persistConversationTurn(
      makeConversation({ status: "active" }),
      { messages: [] },
      { client: fake.client, now },
    );
    expect(fake.updates[0]).not.toHaveProperty("status");

    // Already lead_captured: a later turn must not re-touch status.
    await persistConversationTurn(
      makeConversation({ status: "lead_captured" }),
      { messages: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );
    expect(fake.updates[1]).not.toHaveProperty("status");

    // Abandoned + a capture: status transitions belong to the capture
    // paths (handleChatbotLeadCaptured), not this write — the only
    // transition this function ever makes is the strict active ->
    // lead_captured upgrade.
    await persistConversationTurn(
      makeConversation({ status: "abandoned" }),
      { messages: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );
    expect(fake.updates[2]).not.toHaveProperty("status");
  });
});
