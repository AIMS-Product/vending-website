import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handoffReasonOf,
  listOpenFollowUpTasks,
  summarizeOpenFollowUps,
} from "./chatbot-insights";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const NOW = new Date("2026-09-23T12:00:00.000Z");
const END_OF_TODAY = "2026-09-23T23:59:59.999Z";

describe("handoffReasonOf", () => {
  it("reads the flag_for_team reason out of the dedupe key", () => {
    expect(handoffReasonOf("flag_for_team:abc-123:callback")).toBe("callback");
    expect(handoffReasonOf("flag_for_team:abc-123:support")).toBe("support");
  });

  it("is null for a learning-engine draft", () => {
    expect(handoffReasonOf("abc-123:invite_to_call")).toBeNull();
  });
});

describe("summarizeOpenFollowUps", () => {
  it("counts sales drafts as due and hand-offs separately", () => {
    const summary = summarizeOpenFollowUps(
      [
        { dedupe_key: "a:invite_to_call", due_at: "2026-09-23T08:00:00Z" },
        { dedupe_key: "b:general_follow_up", due_at: "2026-09-30T08:00:00Z" },
        {
          dedupe_key: "flag_for_team:c:support",
          due_at: "2026-09-20T08:00:00Z",
        },
        {
          dedupe_key: "flag_for_team:d:callback",
          due_at: "2026-09-22T08:00:00Z",
        },
      ],
      END_OF_TODAY,
    );
    expect(summary).toEqual({ ready: 2, dueToday: 1, handoffs: 2 });
  });
});

describe("listOpenFollowUpTasks", () => {
  it("labels each row as a sales draft or a hand-off with its reason", async () => {
    const tasks = [
      {
        id: "t1",
        conversation_id: "c1",
        task_type: "invite_to_call",
        priority: 1,
        draft_subject: "Following up",
        draft_body: "Hey",
        due_at: null,
        reason_summary: "Visitor asked about booking a call.",
        dedupe_key: "c1:invite_to_call",
        created_at: "2026-09-22T12:00:00Z",
      },
      {
        id: "t2",
        conversation_id: "c2",
        task_type: "general_follow_up",
        priority: 1,
        draft_subject: null,
        draft_body: null,
        due_at: null,
        reason_summary: "[support] cannot log in",
        dedupe_key: "flag_for_team:c2:support",
        created_at: "2026-09-22T12:00:00Z",
      },
    ];
    const builder = (data: unknown[]) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data, error: null }),
      };
      for (const method of ["eq", "gte", "order", "in"]) {
        chain[method] = () => chain;
      }
      return chain;
    };
    const client = {
      from: (table: string) => ({
        select: () =>
          builder(
            table === "chatbot_follow_up_tasks"
              ? tasks
              : [{ id: "c1", captured_name: "Pat" }],
          ),
      }),
    } as unknown as Client;

    const rows = await listOpenFollowUpTasks(30, { client, now: () => NOW });
    expect(rows.map((r) => [r.id, r.kind, r.handoffReason])).toEqual([
      ["t1", "draft", null],
      ["t2", "handoff", "support"],
    ]);
  });
});
