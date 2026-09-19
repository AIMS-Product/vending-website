import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({ config: {} }));

import { daysBetween, runDataAudit, settledWindow } from "./data-audit-checks";

const now = new Date("2026-09-19T12:30:00.000Z");

/** Rows per table; every query returns that table's rows unfiltered. */
function fakeClient(rows: Record<string, Array<Record<string, unknown>>>) {
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      "gte",
      "gt",
      "lte",
      "lt",
      "eq",
      "is",
      "not",
      "in",
      "order",
      "limit",
    ]) {
      chain[method] = () => chain;
    }
    chain.range = async () => ({ data: rows[table] ?? [], error: null });
    chain.select = (_columns: string, options?: { head?: boolean }) =>
      options?.head ? countable(rows[table] ?? []) : chain;
    // A plain `await` on the builder (the limit/order reads) resolves here.
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: rows[table] ?? [], error: null });
    return chain;
  };
  return {
    from: (table: string) => query(table),
  } as unknown as Pick<SupabaseClient<Database>, "from">;
}

function countable(rows: unknown[]) {
  const result = { count: rows.length, error: null };
  return {
    gte: () => countable(rows),
    gt: () => countable(rows),
    lte: () => countable(rows),
    lt: () => countable(rows),
    eq: () => countable(rows),
    is: () => countable(rows),
    not: () => countable(rows),
    in: () => countable(rows),
    order: () => countable(rows),
    range: () => countable(rows),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
}

describe("settledWindow", () => {
  it("ends before the days a source is still restating", () => {
    expect(settledWindow(now, 2)).toMatchObject({
      from: "2026-09-11",
      to: "2026-09-17",
      exclusiveEnd: "2026-09-18",
    });
  });

  it("gives the exclusive end the live sources need", () => {
    expect(settledWindow(now, 1, 4)).toMatchObject({
      from: "2026-09-15",
      to: "2026-09-18",
      exclusiveEnd: "2026-09-19",
    });
  });
});

describe("daysBetween", () => {
  it("includes both ends", () => {
    expect(daysBetween("2026-09-17", "2026-09-19")).toEqual([
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
  });
});

describe("runDataAudit", () => {
  it("asks GoHighLevel past the window's last day and compares the keys the sync writes", async () => {
    const fetchFormSubmissions = vi.fn(async () => [
      { id: "a", formId: "f1", createdAt: "2026-09-16T10:00:00.000Z" },
      { id: "b", formId: "f1", createdAt: "2026-09-18T10:00:00.000Z" },
      // Outside the window: returned because endAt is exclusive, not counted.
      { id: "c", formId: "f1", createdAt: "2026-09-19T10:00:00.000Z" },
    ]);
    const run = await runDataAudit({
      now,
      client: fakeClient({
        channel_daily: [
          { day: "2026-09-16", leads: 1 },
          { day: "2026-09-18", leads: 1 },
        ],
      }),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: {
        listForms: async () => [{ id: "f1", name: "90 Day Checklist" }],
        fetchFormSubmissions,
        listWorkflows: async () => [],
        fetchWorkflowEmailStats: async () => ({
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
        }),
      },
    });

    expect(fetchFormSubmissions).toHaveBeenCalledWith({
      startAt: "2026-09-12",
      endAt: "2026-09-19",
    });
    const forms = run.results.find((result) => result.checkId === "ghl-forms")!;
    expect(forms).toMatchObject({ status: "pass", ours: 2, source: 2 });
  });

  it("never reports a source it could not reach as agreement", async () => {
    const run = await runDataAudit({
      now,
      client: fakeClient({}),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: null,
    });

    // Every check that needs an outside system says so; none of them passes.
    const configChecks = run.results.filter((result) =>
      result.checkId.endsWith("-config"),
    );
    expect(configChecks.map((result) => result.checkId).sort()).toEqual([
      "ad-spend-config",
      "calendly-config",
      "close-config",
      "ga4-config",
      "ghl-config",
      "youtube-config",
    ]);
    expect(configChecks.every((result) => result.status === "fail")).toBe(true);
    expect(run.summary.status).toBe("fail");
    // And a night where nothing ran is not a healthy night.
    expect(
      run.results.find((result) => result.checkId === "connector-health"),
    ).toMatchObject({ status: "fail" });
  });
});
