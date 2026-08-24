import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloseClient } from "@/lib/close/client";
import type { Database } from "@/types/database";
import type { EngagementConversationRow } from "./engagement-summary";

type ConversationRow = EngagementConversationRow & {
  visitor_hash?: string | null;
};

/**
 * Mirrors the two-query shape in loadVisitorConversations: a maybeSingle()
 * for the conversation linked to the lead, then a bounded list() for every
 * conversation sharing its visitor_hash.
 */
function buildSupabaseClient(options: {
  linked?: ConversationRow | null;
  byVisitor?: ConversationRow[];
  linkedError?: boolean;
  visitorError?: boolean;
  /** close_lead_id returned for the lead_submissions lookup. */
  closeLeadId?: string | null;
  /** Observes the ordering the visitor_hash aggregate asks for. */
  onVisitorOrder?: (options: { ascending?: boolean }) => void;
}) {
  const visitorQuery = vi.fn();
  const leadLookup = vi.fn();

  const all = () => [
    ...(options.byVisitor ?? []),
    ...(options.linked ? [options.linked] : []),
  ];

  const from = vi.fn((table: string) => {
    // resolveCloseLeadId's second hop.
    if (table === "lead_submissions") {
      return {
        select: () => ({
          eq: (_column: string, value: string) => {
            leadLookup(value);
            return {
              maybeSingle: async () => ({
                data: { close_lead_id: options.closeLeadId ?? "lead_close_1" },
                error: null,
              }),
            };
          },
        }),
      };
    }
    if (table !== "chatbot_conversations") {
      throw new Error(`unexpected table ${table}`);
    }
    return {
      select: () => ({
        eq: (column: string, value: string) => {
          if (column === "visitor_hash") {
            visitorQuery(column, value);
            return {
              order: (_col: string, opts: { ascending?: boolean } = {}) => {
                options.onVisitorOrder?.(opts);
                return {
                  limit: async () => ({
                    data: options.visitorError
                      ? null
                      : (options.byVisitor ?? []),
                    error: options.visitorError ? { message: "boom" } : null,
                  }),
                };
              },
            };
          }

          const anchor =
            column === "lead_submission_id"
              ? (options.linked ?? null)
              : (all().find((row) => row.id === value) ?? null);

          return {
            // The anchor lookup: .eq(...).order().limit().maybeSingle()
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: options.linkedError ? null : anchor,
                  error: options.linkedError ? { message: "boom" } : null,
                }),
              }),
            }),
            // resolveCloseLeadId's first hop: .eq("id", ...).maybeSingle()
            maybeSingle: async () => ({
              data: anchor
                ? { lead_submission_id: anchor.lead_submission_id ?? null }
                : null,
              error: null,
            }),
          };
        },
      }),
    };
  });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    visitorQuery,
    leadLookup,
  };
}

function buildCloseClient(
  existingNotes: Array<{ note_html?: string | null }> = [],
) {
  return {
    createNote: vi.fn(async () => ({ id: "acti_new" })),
    listLeadNotes: vi.fn(async () => ({ data: existingNotes })),
  } as unknown as CloseClient;
}

function conversation(
  overrides: Partial<ConversationRow> = {},
): ConversationRow {
  return {
    id: "conv-1",
    page_url: "https://www.vendingpreneurs.com/start",
    created_at: "2026-08-20T10:00:00.000Z",
    messages: [],
    prospect_profile: null,
    visitor_hash: null,
    lead_submission_id: null,
    ...overrides,
  };
}

async function loadWithApiKey(apiKey: string | undefined) {
  vi.resetModules();
  vi.doMock("@/lib/config", () => ({
    config: { CLOSE_API_KEY: apiKey, CLOSE_API_BASE_URL: undefined },
    publicConfig: { siteUrl: "https://www.vendingpreneurs.com" },
  }));
  return import("./close-engagement-note");
}

function noteHtmlOf(closeClient: CloseClient): string {
  const [payload] = (closeClient.createNote as ReturnType<typeof vi.fn>).mock
    .calls[0];
  return payload.note_html as string;
}

describe("writeChatbotEngagementNote", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/config");
  });

  it("writes a briefing carrying the entry page, the job, and the questions", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({
      linked: conversation({
        messages: [
          { role: "user", content: "How do I find locations?", ts: "t" },
          {
            role: "assistant",
            content: "See [Anthony](/case-studies/anthony-kolodziej)",
            ts: "t",
          },
        ],
        prospect_profile: {
          name: null,
          email: null,
          phone: null,
          current_work: "Firefighter",
          capital_signal: null,
          timeline: "Next 3 months",
          state_or_market: null,
          motivation: null,
          objections: [],
          resources_wanted: [],
          call_intent: false,
          sentiment: null,
          follow_up_needed: false,
          summary: null,
        },
      }),
    });
    const closeClient = buildCloseClient();

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("written");
    const html = noteHtmlOf(closeClient);
    expect(html).toContain("Website engagement");
    expect(html).toContain("https://www.vendingpreneurs.com/start");
    expect(html).toContain("What they do now: Firefighter");
    expect(html).toContain("Timeline: Next 3 months");
    expect(html).toContain("How do I find locations?");
    expect(html).toContain("/case-studies/anthony-kolodziej");
    expect(html).toContain("/admin/chatbot/conversations/conv-1");
  });

  it("never posts the same conversation's note twice", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({ linked: conversation() });
    const closeClient = buildCloseClient([
      {
        note_html: "<body><p>chatbot-engagement-ref:conv-1:initial</p></body>",
      },
    ]);

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("duplicate");
    expect(closeClient.createNote).not.toHaveBeenCalled();
  });

  it("aggregates every session sharing a visitor_hash", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client, visitorQuery } = buildSupabaseClient({
      linked: conversation({
        id: "newer",
        created_at: "2026-08-22T10:00:00.000Z",
        visitor_hash: "hash_a",
      }),
      byVisitor: [
        conversation({
          id: "older",
          created_at: "2026-08-20T10:00:00.000Z",
          visitor_hash: "hash_a",
          messages: [
            { role: "user", content: "Asked on the first visit", ts: "t" },
          ],
        }),
        conversation({
          id: "newer",
          created_at: "2026-08-22T10:00:00.000Z",
          visitor_hash: "hash_a",
        }),
      ],
    });
    const closeClient = buildCloseClient();

    await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(visitorQuery).toHaveBeenCalledWith("visitor_hash", "hash_a");
    const html = noteHtmlOf(closeClient);
    expect(html).toContain("Asked on the first visit");
    expect(html).toContain("2 separate chat sessions");
  });

  it("still writes the linked conversation when the aggregate query fails", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({
      linked: conversation({ visitor_hash: "hash_a" }),
      visitorError: true,
    });
    const closeClient = buildCloseClient();

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("written");
  });

  it("stays silent for a lead that never chatted", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({ linked: null });
    const closeClient = buildCloseClient();

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("no-conversation");
    expect(closeClient.listLeadNotes).not.toHaveBeenCalled();
    expect(closeClient.createNote).not.toHaveBeenCalled();
  });

  it("does nothing at all when Close is not configured", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey(undefined);
    const { client } = buildSupabaseClient({ linked: conversation() });
    const closeClient = buildCloseClient();

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("not-configured");
    expect(closeClient.createNote).not.toHaveBeenCalled();
  });

  it("swallows a Close failure rather than failing the sync that called it", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({ linked: conversation() });
    const closeClient = {
      createNote: vi.fn(async () => {
        throw new Error("Close 500");
      }),
      listLeadNotes: vi.fn(async () => ({ data: [] })),
    } as unknown as CloseClient;

    await expect(
      writeChatbotEngagementNote(
        { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
        { client, closeClient },
      ),
    ).resolves.toBe("failed");
  });

  it("escapes html so a visitor's message cannot inject markup into the note", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({
      linked: conversation({
        messages: [
          {
            role: "user",
            content: "<script>alert(1)</script> is that ok?",
            ts: "t",
          },
        ],
      }),
    });
    const closeClient = buildCloseClient();

    await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    const html = noteHtmlOf(closeClient);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

/**
 * The Close sync creates the lead within two minutes of capture, but
 * prospect_profile is written by a later cron. These pin the handoff between
 * the two so the occupation reaches a rep exactly once.
 */
describe("writeChatbotEngagementNote, before and after profile extraction", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/config");
  });

  const PROFILE = {
    name: null,
    email: null,
    phone: null,
    current_work: "Firefighter",
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

  it("marks the pre-extraction note as a first pass", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({ linked: conversation() });
    const closeClient = buildCloseClient();

    await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    const html = noteHtmlOf(closeClient);
    expect(html).toContain("chatbot-engagement-ref:conv-1:initial");
    expect(html).toContain("first pass");
  });

  it("still posts the fuller note once extraction has run", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({
      linked: conversation({ prospect_profile: PROFILE }),
    });
    // The first-pass note is already on the lead.
    const closeClient = buildCloseClient([
      {
        note_html: "<body><p>chatbot-engagement-ref:conv-1:initial</p></body>",
      },
    ]);

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("written");
    const html = noteHtmlOf(closeClient);
    expect(html).toContain("chatbot-engagement-ref:conv-1:full");
    expect(html).toContain("What they do now: Firefighter");
    expect(html).not.toContain("first pass");
  });

  it("stops at two notes: the fuller one is never posted twice", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({
      linked: conversation({ prospect_profile: PROFILE }),
    });
    const closeClient = buildCloseClient([
      {
        note_html: "<body><p>chatbot-engagement-ref:conv-1:initial</p></body>",
      },
      { note_html: "<body><p>chatbot-engagement-ref:conv-1:full</p></body>" },
    ]);

    const result = await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    expect(result).toBe("duplicate");
    expect(closeClient.createNote).not.toHaveBeenCalled();
  });

  it("treats an empty extracted profile as extraction not having told us anything", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client } = buildSupabaseClient({
      linked: conversation({ prospect_profile: {} }),
    });
    const closeClient = buildCloseClient();

    await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient },
    );

    // Still "initial", so a later real extraction can supersede it.
    expect(noteHtmlOf(closeClient)).toContain(
      "chatbot-engagement-ref:conv-1:initial",
    );
  });
});

describe("writeChatbotEngagementNote, returning visitor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/config");
  });

  /**
   * Regression: the digest calls this with only a conversation id, and a
   * returning visitor's newest session carries no lead_submission_id of its
   * own. Resolving the Close lead from the newest session found nothing and
   * dropped the note -- silently losing exactly the multi-session case the
   * visitor_hash aggregation exists to serve.
   */
  it("finds the Close lead through the earlier session that captured the email", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const { client, leadLookup } = buildSupabaseClient({
      linked: conversation({
        id: "newer",
        created_at: "2026-08-22T10:00:00.000Z",
        visitor_hash: "hash_a",
        lead_submission_id: null,
      }),
      byVisitor: [
        conversation({
          id: "older",
          created_at: "2026-08-20T10:00:00.000Z",
          visitor_hash: "hash_a",
          lead_submission_id: "lead_sub_1",
        }),
        conversation({
          id: "newer",
          created_at: "2026-08-22T10:00:00.000Z",
          visitor_hash: "hash_a",
          lead_submission_id: null,
        }),
      ],
    });
    const closeClient = buildCloseClient();

    // No closeLeadId supplied, exactly as the digest calls it.
    const result = await writeChatbotEngagementNote(
      { conversationId: "newer" },
      { client, closeClient },
    );

    expect(result).toBe("written");
    // The point of the fix: the lead was looked up via the OLDER session.
    // Without it, resolution runs on "newer", whose lead_submission_id is
    // null, and lead_submissions is never reached at all.
    expect(leadLookup).toHaveBeenCalledWith("lead_sub_1");
    // The note still links the newest transcript, which is what a rep wants.
    expect(noteHtmlOf(closeClient)).toContain(
      "/admin/chatbot/conversations/newer",
    );
  });
});

describe("writeChatbotEngagementNote, heavy visitor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/config");
  });

  /**
   * The aggregate read is capped. That cap has to drop the OLDEST sessions:
   * ordering ascending returned a heavy visitor's first 20 chats and silently
   * dropped the recent ones, including the session the note is anchored to.
   */
  it("asks for the newest sessions, not the oldest", async () => {
    const { writeChatbotEngagementNote } = await loadWithApiKey("key_1");
    const orderCalls: Array<{ ascending?: boolean }> = [];
    const { client } = buildSupabaseClient({
      linked: conversation({ visitor_hash: "hash_a" }),
      byVisitor: [conversation({ visitor_hash: "hash_a" })],
      onVisitorOrder: (options) => orderCalls.push(options),
    });

    await writeChatbotEngagementNote(
      { leadSubmissionId: "lead_sub_1", closeLeadId: "lead_close_1" },
      { client, closeClient: buildCloseClient() },
    );

    expect(orderCalls[0]?.ascending).toBe(false);
  });
});
