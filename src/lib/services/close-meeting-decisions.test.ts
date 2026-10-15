import { describe, expect, it, vi } from "vitest";
import type { Decision } from "@/lib/booked-calls-v2/engine";
import type { BookedCallsV2Report } from "@/lib/services/booked-calls-v2-data";
import { DECISION_DAYS, snapshotV2Decisions } from "./close-meeting-decisions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const decision = (meetingId: string): Decision =>
  ({
    meetingId,
    leadId: "lead_a",
    createdDay: "2026-10-06",
    disposition: "counted",
    reason: "counted",
    bookedBy: "Marketing",
    ruleVersion: "booked_calls.v2.2",
  }) as Decision;

function fakeClient(fail?: "upsert" | "delete") {
  const calls: { op: string; arg: unknown }[] = [];
  const client = {
    from: () => ({
      upsert: async (rows: unknown) => {
        calls.push({ op: "upsert", arg: rows });
        return { error: fail === "upsert" ? { message: "boom" } : null };
      },
      delete: () => ({
        lt: async (_col: string, value: string) => {
          calls.push({ op: "delete", arg: value });
          return { error: fail === "delete" ? { message: "boom" } : null };
        },
      }),
    }),
  };
  return { client: client as never, calls };
}

const now = new Date("2026-10-15T12:00:00.000Z");
const report = (decisions: Decision[]): BookedCallsV2Report =>
  ({ ok: true, decisions }) as BookedCallsV2Report;

describe("snapshotV2Decisions", () => {
  it("reads the last 70 days, writes every decision, then prunes older runs", async () => {
    const { client, calls } = fakeClient();
    const load = vi.fn(async () => report([decision("m1"), decision("m2")]));
    const out = await snapshotV2Decisions({ client, load, now });
    expect(load).toHaveBeenCalledWith({
      from: new Date(now.getTime() - DECISION_DAYS * 86_400_000).toISOString(),
      to: now.toISOString(),
    });
    expect(out.rowsWritten).toBe(2);
    expect(calls.map((c) => c.op)).toEqual(["upsert", "delete"]);
    expect(calls[0]!.arg).toEqual([
      expect.objectContaining({
        meeting_id: "m1",
        lead_id: "lead_a",
        created_day: "2026-10-06",
        disposition: "counted",
        booked_by: "Marketing",
        computed_at: now.toISOString(),
      }),
      expect.objectContaining({ meeting_id: "m2" }),
    ]);
    expect(calls[1]!.arg).toBe(now.toISOString());
  });

  it("never prunes on an empty read, so an outage keeps the last answer", async () => {
    const { client, calls } = fakeClient();
    await snapshotV2Decisions({ client, load: async () => report([]), now });
    expect(calls).toEqual([]);
  });

  it("throws on a failed read without touching the table", async () => {
    const { client, calls } = fakeClient();
    await expect(
      snapshotV2Decisions({
        client,
        load: async () => ({
          ok: false,
          error: "Could not read Close meetings.",
        }),
        now,
      }),
    ).rejects.toThrow("Could not read Close meetings.");
    expect(calls).toEqual([]);
  });

  it("throws on a failed write and does not prune", async () => {
    const { client, calls } = fakeClient("upsert");
    await expect(
      snapshotV2Decisions({
        client,
        load: async () => report([decision("m1")]),
        now,
      }),
    ).rejects.toThrow("close_meeting_decisions upsert failed");
    expect(calls.map((c) => c.op)).toEqual(["upsert"]);
  });
});
