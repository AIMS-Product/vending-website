import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Only normaliseFacts is spied on; everything else in the module stays real.
// This test only cares whether getKpiTab threads its `includeInternal` input
// through to the rollup, the way Channels already does — not what the report
// looks like.
vi.mock("@/lib/services/channel-report-rollup", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./channel-report-rollup")>();
  return { ...actual, normaliseFacts: vi.fn(actual.normaliseFacts) };
});

import { normaliseFacts } from "@/lib/services/channel-report-rollup";
import { fetchEmailSnapshots, getKpiTab } from "./kpi-report-data";

/** Every table this loader (and the call-credit report it pulls in) reads,
 * answering empty so the run completes without a real database. */
function buildEmptyClient(): Pick<SupabaseClient<Database>, "from"> {
  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const method of [
      "select",
      "order",
      "limit",
      "gte",
      "lte",
      "lt",
      "eq",
      "in",
      "range",
    ]) {
      builder[method] = vi.fn(() => builder);
    }
    (builder as { then: (resolve: (v: unknown) => unknown) => unknown }).then =
      (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
    return builder;
  });
  return { from } as unknown as Pick<SupabaseClient<Database>, "from">;
}

describe("getKpiTab, internal-traffic toggle", () => {
  it("passes includeInternal through to normaliseFacts when set", async () => {
    await getKpiTab({
      client: buildEmptyClient(),
      includeInternal: true,
    });

    expect(normaliseFacts).toHaveBeenCalledWith(expect.any(Array), {
      includeInternal: true,
    });
  });

  it("defaults to excluding internal traffic, same as Channels", async () => {
    await getKpiTab({ client: buildEmptyClient() });

    expect(normaliseFacts).toHaveBeenCalledWith(expect.any(Array), {
      includeInternal: false,
    });
  });
});

type Snapshot = {
  snapshot_day: string;
  workflow_id: string;
  workflow_name: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
};

/** ghl_email_stats stand-in that honours `.range()` and caps pages at 1,000 rows. */
function snapshotClient(rows: Snapshot[], failure: { message: string } | null) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "gte", "lte", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.range = vi.fn((from: number, to: number) =>
    Promise.resolve({
      data: failure ? null : rows.slice(from, Math.min(to + 1, from + 1000)),
      count: rows.length,
      error: failure,
    }),
  );
  return { from: () => builder } as unknown as Parameters<
    typeof fetchEmailSnapshots
  >[0];
}

describe("fetchEmailSnapshots", () => {
  it("returns snapshots from every page, including the latest day", async () => {
    const rows: Snapshot[] = [];
    for (let day = 1; day <= 25; day += 1) {
      for (let workflow = 0; workflow < 60; workflow += 1) {
        rows.push({
          snapshot_day: `2026-09-${String(day).padStart(2, "0")}`,
          workflow_id: `wf-${workflow}`,
          workflow_name: `Workflow ${workflow}`,
          sent: day * 10,
          delivered: day * 9,
          opened: day * 5,
          clicked: day,
          replied: 1,
        });
      }
    }

    const result = await fetchEmailSnapshots(
      snapshotClient(rows, null),
      "2026-09-01",
      "2026-09-25",
    );

    expect(result).toHaveLength(1500);
    expect(result.at(-1)?.snapshot_day).toBe("2026-09-25");
  });

  it("logs and returns an empty list when the read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fetchEmailSnapshots(
      snapshotClient([], { message: "boom" }),
      "2026-09-01",
      "2026-09-25",
    );

    expect(result).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
