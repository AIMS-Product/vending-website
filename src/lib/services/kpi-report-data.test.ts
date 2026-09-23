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
import { getKpiTab } from "./kpi-report-data";

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
