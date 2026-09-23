import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runChatbotLearningPass } from "./run";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const NOW = new Date("2026-09-23T12:00:00.000Z");
const HOURS = 3_600_000;
const ago = (hours: number) =>
  new Date(NOW.getTime() - hours * HOURS).toISOString();

type Op = {
  table: string;
  kind: "select" | "insert" | "update";
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
};

/**
 * Minimal chainable Supabase fake: every call is recorded, and a select
 * resolves to the rows configured for its table.
 */
function fakeClient(tables: Record<string, unknown[]>) {
  const ops: Op[] = [];
  const client = {
    from(table: string) {
      const start = (kind: Op["kind"], payload?: unknown) => {
        const op: Op = { table, kind, payload, filters: [] };
        ops.push(op);
        const result =
          kind === "select"
            ? { data: tables[table] ?? [], error: null }
            : { data: kind === "insert" ? { id: "run-1" } : null, error: null };
        const builder: Record<string, unknown> = {
          then: (resolve: (value: unknown) => unknown) => resolve(result),
        };
        for (const method of ["eq", "in", "not", "like", "order", "limit"]) {
          builder[method] = (column: string, ...args: unknown[]) => {
            op.filters.push([method, column, args]);
            return builder;
          };
        }
        builder.select = () => builder;
        builder.single = () => builder;
        return builder;
      };
      return {
        select: () => start("select"),
        insert: (payload: unknown) => start("insert", payload),
        update: (payload: unknown) => start("update", payload),
      };
    },
  };
  return { client: client as unknown as Client, ops };
}

const message = (content: string) => ({
  role: "user",
  content,
  ts: ago(48),
});

function conversationRow(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    status: "lead_captured",
    created_at: ago(48),
    last_message_at: ago(48),
    messages: [message("can I book a call")],
    captured_name: "Pat",
    captured_email: `${id}@example.com`,
    captured_phone: null,
    prospect_profile: null,
    call_booked_at: null,
    lead_submission_id: null,
    handed_off_at: null,
    ...extra,
  };
}

describe("runChatbotLearningPass draft queue", () => {
  it("drafts only for unbooked sales leads and closes drafts that no longer apply", async () => {
    const { client, ops } = fakeClient({
      chatbot_conversations: [
        conversationRow("sales"),
        conversationRow("lead-booked", { lead_submission_id: "L1" }),
        conversationRow("chat-booked", { call_booked_at: ago(40) }),
        conversationRow("handed-off", { handed_off_at: ago(47) }),
      ],
      lead_submissions: [{ id: "L1" }],
      chatbot_follow_up_tasks: [
        // Existing draft for someone who has since booked: closed.
        {
          id: "t-booked",
          dedupe_key: "lead-booked:general_follow_up",
          conversation_id: "lead-booked",
          created_at: ago(24),
        },
        // Still a genuine unbooked lead: kept.
        {
          id: "t-sales",
          dedupe_key: "sales:general_follow_up",
          conversation_id: "sales",
          created_at: ago(24),
        },
        // Nobody acted on it in a week: expired.
        {
          id: "t-old",
          dedupe_key: "gone:invite_to_call",
          conversation_id: "gone",
          created_at: ago(24 * 10),
        },
        // A hand-off, however old, belongs to its own queue.
        {
          id: "t-handoff",
          dedupe_key: "flag_for_team:handed-off:callback",
          conversation_id: "handed-off",
          created_at: ago(24 * 10),
        },
      ],
    });

    const result = await runChatbotLearningPass({ now: () => NOW }, { client });
    expect(result.ok).toBe(true);

    const drafted = ops
      .filter((op) => op.table === "chatbot_follow_up_tasks")
      .filter((op) => op.kind === "insert" || op.kind === "update")
      .filter(
        (op) => (op.payload as { status?: string })?.status !== "dismissed",
      )
      .flatMap((op) =>
        op.kind === "insert"
          ? (op.payload as Array<{ conversation_id: string }>).map(
              (row) => row.conversation_id,
            )
          : ((op.filters.find(([, column]) => column === "dedupe_key")?.[2] as
              | unknown[]
              | undefined) ?? []),
      );
    for (const id of ["lead-booked", "chat-booked", "handed-off"]) {
      expect(drafted.join(" ")).not.toContain(id);
    }

    const dismissed = ops
      .filter(
        (op) =>
          op.table === "chatbot_follow_up_tasks" &&
          op.kind === "update" &&
          (op.payload as { status?: string }).status === "dismissed",
      )
      .flatMap(
        (op) =>
          (
            op.filters.find(([method]) => method === "in")?.[2] as [string[]]
          )[0],
      );
    expect(dismissed.sort()).toEqual(["t-booked", "t-old"]);
    expect(result.followUpTasksDismissed).toBe(2);
  });

  it("never re-stamps due_at on a draft it already wrote", async () => {
    const { client, ops } = fakeClient({
      chatbot_conversations: [conversationRow("sales")],
      chatbot_follow_up_tasks: [
        {
          id: "t-sales",
          dedupe_key: "sales:invite_to_call",
          conversation_id: "sales",
          created_at: ago(24),
        },
      ],
    });
    await runChatbotLearningPass({ now: () => NOW }, { client });
    const refreshes = ops.filter(
      (op) =>
        op.table === "chatbot_follow_up_tasks" &&
        op.kind === "update" &&
        op.payload !== null &&
        typeof op.payload === "object" &&
        "draft_body" in op.payload,
    );
    expect(refreshes.length).toBeGreaterThan(0);
    for (const op of refreshes) {
      expect(op.payload).not.toHaveProperty("due_at");
    }
  });
});
