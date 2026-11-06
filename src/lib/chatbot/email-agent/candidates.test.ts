import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  config: { CHATBOT_EMAIL_ALLOWLIST: "*" },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
const pushed = vi.fn(async () => ({ sent: 1, skipped: 0 }));
vi.mock("@/lib/chatbot/close-handoff", () => ({
  HANDOFF_DEDUPE_PREFIX: "flag_for_team:",
  writeChatbotHandoffsToClose: (...args: unknown[]) => pushed(...(args as [])),
}));

import { followUpCandidates, handOffQuietLeads } from "./agent";

const NOW = new Date("2026-11-05T12:00:00Z");
const chat = (id: string, lead: string | null) => ({
  id,
  captured_email: `${id}@example.com`,
  call_booked_at: null,
  messages: [{ role: "user", content: "hi", ts: "2026-11-05T09:00:00Z" }],
  last_message_at: "2026-11-05T09:00:00Z",
  lead_submission_id: lead,
});

/** Thenable query stub: every builder call returns itself, await yields rows. */
function query(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "not", "is", "lte", "gte", "order", "limit", "in"])
    q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown) => ok({ data: rows, error: null });
  return q;
}

describe("followUpCandidates", () => {
  it("drops chats whose lead already has a Close booked date", async () => {
    const client = {
      from: (table: string) =>
        table === "lead_submissions"
          ? query([{ id: "lead-booked" }])
          : query([
              chat("a", "lead-booked"),
              chat("b", "lead-open"),
              chat("c", null),
            ]),
    };
    const ids = await followUpCandidates(
      { minAgeMinutes: 60, limit: 20 },
      { client: client as never, now: () => NOW },
    );
    expect(ids).toEqual(["b", "c"]);
  });
});

const finished = (id: string) => ({
  ...chat(id, null),
  captured_phone: null,
  messages: [
    { role: "user", content: "hi", ts: "2026-11-01T09:00:00Z" },
    {
      role: "assistant",
      content: "last email",
      ts: "2026-11-04T09:00:00Z",
      kind: "email_sent",
      data: { step: "final" },
    },
  ],
});

describe("handOffQuietLeads", () => {
  it("hands a new quiet lead over, retries an open one, skips a delivered one", async () => {
    pushed.mockClear();
    const inserted: string[] = [];
    const client = {
      from: (table: string) => {
        if (table === "chatbot_conversations")
          return query([finished("new"), finished("retry"), finished("done")]);
        if (table === "lead_submissions") return query([]);
        const q = query([
          { dedupe_key: "flag_for_team:retry:email_quiet", status: "open" },
          { dedupe_key: "flag_for_team:done:email_quiet", status: "sent" },
        ]);
        return {
          ...q,
          insert: async (row: { conversation_id: string }) => {
            inserted.push(row.conversation_id);
            return { error: null };
          },
        };
      },
    };
    const handed = await handOffQuietLeads(
      { limit: 5 },
      { client: client as never, now: () => NOW },
    );
    expect(inserted).toEqual(["new"]);
    expect(pushed).toHaveBeenCalledTimes(2);
    expect(handed.map((h) => h.conversationId)).toEqual(["new", "retry"]);
    expect(handed[0].kind).toBe("no_reply");
  });
});
