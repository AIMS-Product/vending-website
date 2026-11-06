import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloseClient } from "@/lib/close/client";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({
  config: { CLOSE_API_KEY: "key", CLOSE_API_BASE_URL: "https://close.test" },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("should use injected client");
  },
}));

const { writeChatbotHandoffsToClose, taskText } =
  await import("./close-handoff");

const TASK = {
  id: "task-1",
  reason_summary:
    "[callback] Wants a call about a full route · Preferred window: Thursday after 6 · Phone: 5551234567",
  dedupe_key: "flag_for_team:conv-1:callback",
  created_at: "2026-08-27T12:00:00Z",
};

function buildSupabase(options: {
  tasks?: (typeof TASK)[];
  closeLeadId?: string | null;
}) {
  const updated: string[] = [];
  const from = vi.fn((table: string) => {
    if (table === "chatbot_follow_up_tasks") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              like: async () => ({
                data: options.tasks ?? [TASK],
                error: null,
              }),
            }),
          }),
        }),
        update: (patch: { status: string }) => ({
          eq: async (_col: string, id: string) => {
            updated.push(`${id}:${patch.status}`);
            return { error: null };
          },
        }),
      };
    }
    if (table === "chatbot_conversations") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { lead_submission_id: "lead-1" },
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
              data: {
                close_lead_id:
                  options.closeLeadId === undefined
                    ? "lead_close_1"
                    : options.closeLeadId,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    updated,
  };
}

function buildClose(existingNotes: Array<{ note_html: string }> = []) {
  const createNote = vi.fn(async () => ({ id: "acti_1" }));
  const createTask = vi.fn(async () => ({ id: "task_close_1" }));
  const listLeadNotes = vi.fn(async () => ({ data: existingNotes }));
  return {
    closeClient: {
      createNote,
      createTask,
      listLeadNotes,
    } as unknown as CloseClient,
    createNote,
    createTask,
  };
}

describe("writeChatbotHandoffsToClose", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("writes one note and one task per open hand-off, then marks it sent", async () => {
    const { client, updated } = buildSupabase({});
    const close = buildClose();
    const result = await writeChatbotHandoffsToClose(
      { conversationId: "conv-1" },
      { client, closeClient: close.closeClient },
    );
    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(close.createNote).toHaveBeenCalledTimes(1);
    expect(close.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: "lead",
        lead_id: "lead_close_1",
        text: expect.stringContaining("Chatbot callback requested"),
      }),
    );
    expect(updated).toEqual(["task-1:sent"]);
  });

  it("never creates a second task when the note already exists", async () => {
    const { client, updated } = buildSupabase({});
    const close = buildClose([{ note_html: "x chatbot-handoff:task-1 x" }]);
    const result = await writeChatbotHandoffsToClose(
      { conversationId: "conv-1" },
      { client, closeClient: close.closeClient },
    );
    expect(result.sent).toBe(1);
    expect(close.createTask).not.toHaveBeenCalled();
    expect(updated).toEqual(["task-1:sent"]);
  });

  it("leaves the task open when the Close lead does not exist yet", async () => {
    const { client, updated } = buildSupabase({ closeLeadId: null });
    const close = buildClose();
    const result = await writeChatbotHandoffsToClose(
      { conversationId: "conv-1" },
      { client, closeClient: close.closeClient },
    );
    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(close.createTask).not.toHaveBeenCalled();
    expect(updated).toEqual([]);
  });

  it("labels task text by reason", () => {
    expect(
      taskText("[support] Silver member cannot log in · Email: a@b.co"),
    ).toMatch(/^Chatbot: existing member needs support: Silver member/);
    expect(taskText("[accessibility] hard of hearing")).toMatch(
      /text or email/,
    );
  });
});

describe("routing a hand-off to the setter", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  function closeWithLead(custom: Record<string, unknown>) {
    const base = buildClose();
    const getLead = vi.fn(async () => ({ id: "lead_close_1", custom }));
    const updateLead = vi.fn(async () => ({}));
    Object.assign(base.closeClient, { getLead, updateLead });
    return { ...base, updateLead };
  }
  const QUIET = {
    ...TASK,
    reason_summary: "[email_quiet] Mia emailed them 3 times, no reply.",
    dedupe_key: "flag_for_team:conv-1:email_quiet",
  };

  it("assigns the task to the Lead Owner and puts a never-called lead back on the hot list", async () => {
    const { client } = buildSupabase({ tasks: [QUIET] });
    const close = closeWithLead({
      "Lead Owner": "user_setter",
      "Ever Had Call": "No",
      "Recapture State": "Active-Nurture",
    });
    await writeChatbotHandoffsToClose(
      { conversationId: "conv-1" },
      { client, closeClient: close.closeClient },
    );
    expect(close.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        assigned_to: "user_setter",
        text: expect.stringContaining("Hot: chatbot email lead went quiet"),
      }),
    );
    expect(close.updateLead).toHaveBeenCalledWith("lead_close_1", {
      "custom.cf_hKcyx4tQSMvHd7llfLX363bx3LGXMxVEmFHEtjpR5C2": "Hot-Inbound",
    });
  });

  it("never re-stamps a lead that has had a call, or a support hand-off", async () => {
    const quiet = buildSupabase({ tasks: [QUIET] });
    const called = closeWithLead({ "Ever Had Call": "Yes" });
    await writeChatbotHandoffsToClose(
      { conversationId: "conv-1" },
      { client: quiet.client, closeClient: called.closeClient },
    );
    expect(called.updateLead).not.toHaveBeenCalled();

    const support = buildSupabase({
      tasks: [{ ...TASK, reason_summary: "[support] Can't log in." }],
    });
    const fresh = closeWithLead({ "Ever Had Call": "No" });
    await writeChatbotHandoffsToClose(
      { conversationId: "conv-1" },
      { client: support.client, closeClient: fresh.closeClient },
    );
    expect(fresh.updateLead).not.toHaveBeenCalled();
  });
});
