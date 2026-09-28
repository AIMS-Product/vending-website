import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { addDays } from "@/lib/seo/triggers";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { absolute, pageMetrics, runSeoTriggers } from "./seo-trigger-job";

const AS_OF = "2026-09-25";
const PAGE = "https://www.vendingpreneurs.com/news/best-vending-locations";

/** A PostgREST stand-in: every filter is a no-op, reads return the table. */
function fakeClient(tables: Record<string, unknown[]>) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const from = vi.fn((table: string) => {
    let range: [number, number] | null = null;
    const rows = () => tables[table] ?? [];
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "gte", "eq", "not", "in"]) {
      chain[m] = () => chain;
    }
    chain.range = (a: number, b: number) => ((range = [a, b]), chain);
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({
        data: range ? rows().slice(range[0], range[1] + 1) : rows(),
        count: rows().length,
        error: null,
      });
    chain.insert = async (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      return { error: null };
    };
    chain.update = (patch: Record<string, unknown>) => {
      updates.push({ table, patch });
      return { eq: async () => ({ error: null }) };
    };
    return chain;
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    inserts,
    updates,
  };
}

/** A page in striking distance: position 7, impressions +20%. */
const pageDays = Array.from({ length: 70 }, (_, i) => ({
  day: addDays(AS_OF, -(69 - i)),
  page: PAGE,
  clicks: 0,
  impressions: i >= 42 ? 6 : 5,
  position: "7.00",
}));

describe("runSeoTriggers", () => {
  it("opens a task for a new hit with the playbook and a due date", async () => {
    const { client, inserts } = fakeClient({
      seo_gsc_page_daily: [{ day: AS_OF }, ...pageDays].slice(0),
      seo_tasks: [],
    });
    // The first read (latest day) takes row 0; later reads get the whole table.
    const result = await runSeoTriggers({
      client,
      now: new Date("2026-09-28T14:00:00Z"),
    });
    const task = inserts.find((i) => i.table === "seo_tasks")?.row;
    expect(result.asOf).toBe(AS_OF);
    expect(task).toMatchObject({
      trigger_code: 1,
      url: PAGE,
      priority: "high",
      created_by: "system",
      due_date: "2026-10-05",
    });
    expect(String(task?.detail)).toMatch(/^Optimize for top 3/);
    expect(result.connector).toMatchObject({
      connector: "seo-triggers",
      error: null,
    });
  });

  it("updates the open task instead of opening a duplicate", async () => {
    const { client, inserts, updates } = fakeClient({
      seo_gsc_page_daily: [{ day: AS_OF }, ...pageDays],
      seo_tasks: [{ id: "t1", trigger_code: 1, url: PAGE, subject: null }],
    });
    const result = await runSeoTriggers({
      client,
      now: new Date("2026-09-28T14:00:00Z"),
    });
    expect(inserts.filter((i) => i.table === "seo_tasks")).toHaveLength(0);
    expect(result.updated).toBe(1);
    expect(updates[0]?.patch.evidence).toMatchObject({ position: 7 });
  });
});

describe("pageMetrics", () => {
  it("reports the page's 28 days with CTR and weighted position", () => {
    const rows = [
      { day: AS_OF, page: PAGE, clicks: 2, impressions: 100, position: 4 },
      { day: AS_OF, page: "other", clicks: 9, impressions: 9, position: 1 },
    ];
    expect(pageMetrics(rows, PAGE, AS_OF)).toEqual({
      asOf: AS_OF,
      impressions28: 100,
      clicks28: 2,
      ctrPct: 2,
      position: 4,
    });
    expect(absolute("/resources/x")).toBe(
      "https://www.vendingpreneurs.com/resources/x",
    );
  });
});
