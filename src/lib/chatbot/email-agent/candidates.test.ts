import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  config: { CHATBOT_EMAIL_ALLOWLIST: "*" },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { followUpCandidates } from "./agent";

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
