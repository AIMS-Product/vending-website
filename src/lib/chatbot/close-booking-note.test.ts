import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CloseApiError, type CloseClient } from "@/lib/close/client";
import type { Database } from "@/types/database";
import type { StampChatbotBookingOnCloseLeadInput } from "./close-booking-note";

type FakeRow = {
  conversation?: { lead_submission_id: string | null } | null;
  lead?: { close_lead_id: string | null } | null;
};

function buildSupabaseClient(rows: FakeRow) {
  const from = vi.fn((table: string) => {
    if (table === "chatbot_conversations") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: rows.conversation ?? null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "lead_submissions") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: rows.lead ?? null,
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from } as unknown as Pick<SupabaseClient<Database>, "from">;
}

function buildCloseClient(
  options: {
    existingNotes?: Array<{ note_html?: string | null; note?: string | null }>;
    createNoteImpl?: () => Promise<{ id: string }>;
  } = {},
) {
  const createNote = vi.fn(
    options.createNoteImpl ?? (async () => ({ id: "acti_new" })),
  );
  const listLeadNotes = vi.fn(async () => ({
    data: options.existingNotes ?? [],
  }));
  return { createNote, listLeadNotes } as unknown as CloseClient;
}

const BASE_INPUT: StampChatbotBookingOnCloseLeadInput = {
  conversationId: "conv-1",
  attributionSource: "in_chat",
  scheduledEventName: "30 Minute Sales Call",
  eventStartAt: "2026-08-25T15:00:00.000Z",
};

/** Reimports the module fresh with the given CLOSE_API_KEY baked into config. */
async function loadWithApiKey(apiKey: string | undefined) {
  vi.resetModules();
  vi.doMock("@/lib/config", () => ({
    config: { CLOSE_API_KEY: apiKey, CLOSE_API_BASE_URL: undefined },
    publicConfig: { siteUrl: "https://www.vendingpreneurs.com" },
  }));
  return import("./close-booking-note");
}

describe("stampChatbotBookingOnCloseLead", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/config");
  });

  it("writes an in_chat note naming the event, its time, and the transcript link", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey("key_1");
    const client = buildSupabaseClient({
      conversation: { lead_submission_id: "lead_sub_1" },
      lead: { close_lead_id: "lead_close_1" },
    });
    const closeClient = buildCloseClient();

    await stampChatbotBookingOnCloseLead(BASE_INPUT, { client, closeClient });

    expect(closeClient.createNote).toHaveBeenCalledTimes(1);
    const [payload] = (closeClient.createNote as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(payload.lead_id).toBe("lead_close_1");
    expect(payload.note_html).toContain(
      "booked their call directly from the calendar inside the site chatbot",
    );
    expect(payload.note_html).toContain("30 Minute Sales Call");
    expect(payload.note_html).toContain("2026-08-25T15:00:00.000Z");
    expect(payload.note_html).toContain(
      "https://www.vendingpreneurs.com/admin/chatbot/conversations/conv-1",
    );
  });

  it("words an email_match note differently: chatted first, booked later elsewhere", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey("key_1");
    const client = buildSupabaseClient({
      conversation: { lead_submission_id: "lead_sub_1" },
      lead: { close_lead_id: "lead_close_1" },
    });
    const closeClient = buildCloseClient();

    await stampChatbotBookingOnCloseLead(
      { ...BASE_INPUT, attributionSource: "email_match" },
      { client, closeClient },
    );

    const [payload] = (closeClient.createNote as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(payload.note_html).toContain(
      "chatted with the site chatbot first, then booked their call later through a different link",
    );
    expect(payload.note_html).not.toContain(
      "booked their call directly from the calendar inside the site chatbot",
    );
  });

  it("does nothing when the conversation has no lead_submission_id", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey("key_1");
    const client = buildSupabaseClient({
      conversation: { lead_submission_id: null },
    });
    const closeClient = buildCloseClient();

    await stampChatbotBookingOnCloseLead(BASE_INPUT, { client, closeClient });

    expect(closeClient.createNote).not.toHaveBeenCalled();
    expect(closeClient.listLeadNotes).not.toHaveBeenCalled();
  });

  it("does nothing when the lead has no close_lead_id", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey("key_1");
    const client = buildSupabaseClient({
      conversation: { lead_submission_id: "lead_sub_1" },
      lead: { close_lead_id: null },
    });
    const closeClient = buildCloseClient();

    await stampChatbotBookingOnCloseLead(BASE_INPUT, { client, closeClient });

    expect(closeClient.createNote).not.toHaveBeenCalled();
  });

  it("never throws and makes no Close or Supabase call when no API key is configured", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey(undefined);
    const from = vi.fn();
    const client = { from } as unknown as Pick<
      SupabaseClient<Database>,
      "from"
    >;
    const closeClient = buildCloseClient();

    await expect(
      stampChatbotBookingOnCloseLead(BASE_INPUT, { client, closeClient }),
    ).resolves.toBeUndefined();

    expect(from).not.toHaveBeenCalled();
    expect(closeClient.createNote).not.toHaveBeenCalled();
  });

  it("swallows a Close 400 with a warning instead of throwing", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey("key_1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = buildSupabaseClient({
      conversation: { lead_submission_id: "lead_sub_1" },
      lead: { close_lead_id: "lead_close_1" },
    });
    const closeClient = buildCloseClient({
      createNoteImpl: async () => {
        throw new CloseApiError(400, "Close API request failed with 400");
      },
    });

    await expect(
      stampChatbotBookingOnCloseLead(BASE_INPUT, { client, closeClient }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not post a second note when the same booking is stamped twice", async () => {
    const { stampChatbotBookingOnCloseLead } = await loadWithApiKey("key_1");
    const client = buildSupabaseClient({
      conversation: { lead_submission_id: "lead_sub_1" },
      lead: { close_lead_id: "lead_close_1" },
    });
    // Simulates the second run: listLeadNotes already returns the note this
    // function itself would have written the first time.
    const closeClient = buildCloseClient({
      existingNotes: [
        {
          note_html:
            "<body><p>Reference: chatbot-booking-ref:conv-1:2026-08-25T15:00:00.000Z</p></body>",
        },
      ],
    });

    await stampChatbotBookingOnCloseLead(BASE_INPUT, { client, closeClient });

    expect(closeClient.listLeadNotes).toHaveBeenCalledWith("lead_close_1");
    expect(closeClient.createNote).not.toHaveBeenCalled();
  });
});
