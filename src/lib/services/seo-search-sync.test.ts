import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  SearchConsoleClient,
  SearchConsoleRow,
} from "@/lib/search-console/client";
import { dailyRows, syncSeoSearchDetail } from "./seo-search-sync";

const row = (
  keys: string[],
  clicks: number,
  impressions: number,
  position = 5,
): SearchConsoleRow => ({ keys, clicks, impressions, position });

function buildClient(upsertError: { code?: string; message: string } | null) {
  const upserts: Record<string, Array<Record<string, unknown>>> = {};
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((name: string) => ({
    insert: vi.fn(async (r: Record<string, unknown>) => {
      runs.push(r);
      return { error: null };
    }),
    upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
      (upserts[name] ??= []).push(...rows);
      return { error: upsertError };
    }),
  }));
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

function fakeSearchConsole(): SearchConsoleClient {
  return {
    fetchDailyTotals: vi.fn(),
    listSites: vi.fn(),
    fetchRows: vi.fn(async ({ dimensions }) => {
      const key = dimensions.join("+");
      if (key === "date") return [row(["2026-09-20"], 2, 170, 10.71)];
      if (key === "date+query")
        return [
          row(["2026-09-20", "vendingpreneurs"], 1, 40),
          row(["2026-09-20", "vending machine items"], 1, 30),
        ];
      if (key === "date+page")
        return [row(["2026-09-20", "https://www.vendingpreneurs.com/"], 2, 90)];
      return [
        row(
          ["2026-09-20", "vendingpreneurs", "https://www.vendingpreneurs.com/"],
          1,
          40,
        ),
        row(
          [
            "2026-09-20",
            "vendingpreneurs",
            "https://www.vendingpreneurs.com/about",
          ],
          0,
          40,
        ),
      ];
    }),
  };
}

const window = { startDate: "2026-09-18", endDate: "2026-09-27" };

describe("syncSeoSearchDetail", () => {
  it("writes day, page and query rows and logs one run", async () => {
    const { client, upserts, runs } = buildClient(null);
    const outcome = await syncSeoSearchDetail({
      client,
      searchConsole: fakeSearchConsole(),
      notConfigured: "",
      ...window,
    });

    expect(outcome).toEqual({
      connector: "seo-search-console",
      rowsWritten: 4,
      error: null,
    });
    expect(upserts.seo_gsc_daily).toEqual([
      {
        day: "2026-09-20",
        clicks: 2,
        impressions: 170,
        position: 10.71,
        brand_clicks: 1,
        // From the date + query report (40), not the two page rows (80).
        brand_impressions: 40,
      },
    ]);
    expect(upserts.seo_gsc_query_daily).toHaveLength(2);
    expect(upserts.seo_gsc_page_daily?.[0]).toMatchObject({
      page: "https://www.vendingpreneurs.com/",
      impressions: 90,
    });
    expect(runs[0]).toMatchObject({ connector: "seo-search-console" });
  });

  it("skips, not fails, while the migration has not been pasted", async () => {
    const { client } = buildClient({
      code: "PGRST205",
      message: "Could not find the table 'public.seo_gsc_daily'",
    });
    const outcome = await syncSeoSearchDetail({
      client,
      searchConsole: fakeSearchConsole(),
      notConfigured: "",
      ...window,
    });
    expect(outcome.error).toMatch(/^skipped: table missing/);
  });

  it("skips when Search Console is not configured", async () => {
    const { client } = buildClient(null);
    const outcome = await syncSeoSearchDetail({
      client,
      searchConsole: null,
      notConfigured: "GSC_SITE_URL is not set.",
      ...window,
    });
    expect(outcome.error).toBe("skipped: GSC_SITE_URL is not set.");
  });
});

describe("dailyRows", () => {
  it("never reports more branded searches than the day's total", () => {
    const [day] = dailyRows(
      [row(["2026-09-20"], 1, 10)],
      [row(["2026-09-20", "vendingpreneurs"], 3, 50)],
    );
    expect(day).toMatchObject({ brand_clicks: 1, brand_impressions: 10 });
  });
});
