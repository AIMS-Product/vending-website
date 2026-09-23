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
    handoff_emailed_at: null,
    handoff_emailed_to: null,
    handoff_email_error: null,
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
      { append: [], capturedEmail: null, capturedPhone: null },
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
      { append: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );

    expect(fake.updates[0]?.captured_email).toBe("jane@example.com");
  });

  it("upgrades active to lead_captured when this turn captures contact info", async () => {
    const fake = fakeClient();
    const conversation = makeConversation({ status: "active" });

    await persistConversationTurn(
      conversation,
      { append: [], capturedEmail: "jane@example.com" },
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
      { append: [] },
      { client: fake.client, now },
    );
    expect(fake.updates[0]).not.toHaveProperty("status");

    // Already lead_captured: a later turn must not re-touch status.
    await persistConversationTurn(
      makeConversation({ status: "lead_captured" }),
      { append: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );
    expect(fake.updates[1]).not.toHaveProperty("status");

    // Abandoned + a capture: status transitions belong to the capture
    // paths (handleChatbotLeadCaptured), not this write — the only
    // transition this function ever makes is the strict active ->
    // lead_captured upgrade.
    await persistConversationTurn(
      makeConversation({ status: "abandoned" }),
      { append: [], capturedEmail: "jane@example.com" },
      { client: fake.client, now },
    );
    expect(fake.updates[2]).not.toHaveProperty("status");
  });
});

describe("persistConversationTurn, entry page", () => {
  /**
   * page_url answers "what page pulled this visitor in", and the widget
   * survives navigation, so a later turn sent from a different page must not
   * rewrite it. It fed a rep the last page the visitor happened to be on
   * instead of the one that brought them.
   */
  it("does not rewrite the entry page when the visitor navigates mid-chat", async () => {
    const fake = fakeClient();
    const conversation = makeConversation({ page_url: "/start" });

    await persistConversationTurn(
      conversation,
      { append: [], pageUrl: "/pricing" },
      { client: fake.client, now },
    );

    expect(fake.updates[0]).not.toHaveProperty("page_url");
  });

  it("still records a page when the conversation has none yet", async () => {
    const fake = fakeClient();
    const conversation = makeConversation({ page_url: null });

    await persistConversationTurn(
      conversation,
      { append: [], pageUrl: "/pricing" },
      { client: fake.client, now },
    );

    expect(fake.updates[0]).toMatchObject({ page_url: "/pricing" });
  });
});

/**
 * One chatbot_conversations row with real compare-and-set semantics:
 * update().eq("id").eq("message_count", n) only lands when the stored count is
 * still n. `beforeWrite` runs between a writer's read and its write, which is
 * exactly where a second writer sneaks in.
 */
function tableClient(
  row: { messages: unknown[]; message_count: number },
  beforeWrite: () => Promise<void> = async () => {},
) {
  return {
    from() {
      return {
        select() {
          return {
            eq: () => ({
              single: async () => ({
                data: {
                  messages: [...row.messages],
                  message_count: row.message_count,
                },
                error: null,
              }),
            }),
          };
        },
        update(patch: Record<string, unknown>) {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              return chain;
            },
            async select() {
              await beforeWrite();
              if (
                "message_count" in filters &&
                filters.message_count !== row.message_count
              ) {
                return { data: [], error: null };
              }
              Object.assign(row, patch);
              return { data: [{ id: "conv-1" }], error: null };
            },
            then(resolve: (value: { error: null }) => unknown) {
              Object.assign(row, patch);
              return Promise.resolve(resolve({ error: null }));
            },
          };
          return chain;
        },
      };
    },
  } as unknown as PersistClient;
}

const msg = (content: string) => ({
  role: "assistant" as const,
  content,
  ts: "2026-09-23T00:00:00.000Z",
});

describe("persistConversationTurn appends, it never rewrites", () => {
  it("keeps a quick-action card that lands while a chat turn is saving, and the turn too", async () => {
    const row = { messages: [msg("greeting")] as unknown[], message_count: 1 };
    let interleaved = false;
    // The chat turn reads the row, then the quick action appends its card
    // before the turn writes. The old whole-array write deleted the card.
    const chatClient = tableClient(row, async () => {
      if (interleaved) return;
      interleaved = true;
      await persistConversationTurn(
        makeConversation(),
        { append: [msg("calendar card")] },
        { client: tableClient(row), now },
      );
    });

    await persistConversationTurn(
      makeConversation(),
      { append: [msg("visitor turn"), msg("reply")] },
      { client: chatClient, now },
    );

    expect(
      (row.messages as Array<{ content: string }>).map((m) => m.content),
    ).toEqual(["greeting", "calendar card", "visitor turn", "reply"]);
    expect(row.message_count).toBe(4);
  });

  it("gives up loudly rather than dropping a turn when it can never win", async () => {
    const row = { messages: [] as unknown[], message_count: 0 };
    const alwaysBusy = tableClient(row, async () => {
      row.message_count += 1;
    });
    await expect(
      persistConversationTurn(
        makeConversation(),
        { append: [msg("x")] },
        { client: alwaysBusy, now },
      ),
    ).rejects.toThrow(/losing the race/);
  });

  it("leaves the transcript alone when there is nothing to append (capture form)", async () => {
    const row = { messages: [msg("keep me")] as unknown[], message_count: 1 };
    await persistConversationTurn(
      makeConversation(),
      { append: [], capturedEmail: "jane@example.com" },
      { client: tableClient(row), now },
    );
    expect(row.messages).toHaveLength(1);
    expect(row).toMatchObject({ captured_email: "jane@example.com" });
  });
});
