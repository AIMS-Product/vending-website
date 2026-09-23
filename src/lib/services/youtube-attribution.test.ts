import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the test must pass its own client");
  },
}));

const { getYouTubeAttribution, MAX_PAGE_VIEW_ROWS } =
  await import("./youtube-attribution");

type Call = { method: string; args: unknown[] };

/**
 * A chainable PostgREST stand-in: every builder method records its call and
 * returns itself, and awaiting it yields the canned result. `range` slices the
 * rows the way PostgREST does, so a paged read sees one page per request.
 */
function builder(
  rows: unknown[],
  error: unknown,
  calls: Call[],
  inFlight: { now: number; max: number },
) {
  const target: Record<string, unknown> = {};
  let window: [number, number] | null = null;
  for (const method of [
    "select",
    "gte",
    "not",
    "neq",
    "order",
    "limit",
    "eq",
    "or",
  ]) {
    target[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return target;
    };
  }
  target.range = (from: number, to: number) => {
    calls.push({ method: "range", args: [from, to] });
    window = [from, to];
    return target;
  };
  target.then = (resolve: unknown, reject: unknown) => {
    inFlight.now += 1;
    inFlight.max = Math.max(inFlight.max, inFlight.now);
    // Settles a macrotask later, so concurrent pages overlap the way real
    // round trips do and sequential ones never do.
    return new Promise((settle) => setTimeout(settle, 0))
      .then(() => {
        inFlight.now -= 1;
        return {
          data: error
            ? null
            : window
              ? rows.slice(window[0], window[1] + 1)
              : rows,
          error,
        };
      })
      .then(
      resolve as (v: unknown) => unknown,
        reject as (e: unknown) => unknown,
      );
  };
  return { target, calls };
}

function buildClient(
  rows: Record<string, unknown[]>,
  failing: string[],
  errors: Record<string, unknown> = {},
) {
  // Accumulated per table: concurrent pages each build their own query.
  const calls: Record<string, Call[]> = {};
  // Per table too: the tab reads its tables in parallel with each other.
  const inFlight: Record<string, { now: number; max: number }> = {};
  const from = vi.fn((table: string) => {
    calls[table] ??= [];
    inFlight[table] ??= { now: 0, max: 0 };
    const b = builder(
      rows[table] ?? [],
      errors[table] ??
        (failing.includes(table) ? { message: "boom" } : null),
      calls[table],
      inFlight[table],
    );
    return b.target as never;
  });
  return { client: { from } as never, calls, inFlight };
}

const NOW = new Date("2026-09-10T12:00:00.000Z");

describe("getYouTubeAttribution reads", () => {
  it("reads the visit's channel and only scans rows that carry a campaign", async () => {
    const { calls } = await run({});

    const select = calls.lead_page_views.find((c) => c.method === "select");
    expect(select?.args[0]).toContain("utm_source");
    // The table's index is partial on utm_campaign, and a view with no
    // campaign is discarded by the rollup anyway.
    expect(calls.lead_page_views).toContainEqual({
      method: "not",
      args: ["utm_campaign", "is", null],
    });
    expect(calls.bitly_link_clicks).toContainEqual({
      method: "not",
      args: ["utm_campaign", "is", null],
    });
  });

  it("pages every read that can outgrow PostgREST's 1,000-row response cap", async () => {
    const { calls } = await run({});

    for (const table of [
      "ga4_page_views",
      "lead_page_views",
      "bitly_link_clicks",
    ]) {
      expect(calls[table]).toContainEqual({ method: "range", args: [0, 999] });
    }
  });

  it("sums every page of GA4 rows, not just the first 1,000", async () => {
    const rows = Array.from({ length: 2_500 }, () => ({
      utm_source: "youtube",
      utm_campaign: "zach",
      day: "2026-09-01",
      sessions: 1,
    }));

    const { result, calls } = await run({ ga4_page_views: rows });

    expect(result.totals.visits).toBe(2_500);
    // The last page, read in primary-key order so pages never overlap.
    expect(calls.ga4_page_views).toContainEqual({
      method: "range",
      args: [2000, 2999],
    });
    expect(calls.ga4_page_views).toContainEqual({
      method: "order",
      args: ["day"],
    });
  });

  it("reads the pages of a long range concurrently, and every row once", async () => {
    const rows = Array.from({ length: 7_001 }, () => ({
      utm_source: "youtube",
      utm_campaign: "zach",
      day: "2026-09-01",
      sessions: 1,
    }));

    const { result, inFlight } = await run({ ga4_page_views: rows });

    expect(result.totals.visits).toBe(7_001);
    // Sequential pages never overlap: the 1-year read was 16 round trips.
    expect(inFlight.ga4_page_views?.max).toBeGreaterThan(1);
  });

  it("reports a truncated read as unmeasured rather than as a low number", async () => {
    const views = Array.from({ length: MAX_PAGE_VIEW_ROWS }, () => ({
      utm_source: "youtube",
      utm_campaign: "how-much-vending",
      occurred_at: "2026-09-01T00:00:00.000Z",
    }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await run({ lead_page_views: views });

    expect(result.totals.visits).toBeNull();
    expect(result.coverage.visitsConnected).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("reads visits from GA4 sessions when GA4 has rows", async () => {
    const { result, calls } = await run({
      ga4_page_views: [
        {
          utm_source: "youtube",
          utm_campaign: "zach",
          day: "2026-09-01",
          sessions: 569,
        },
        // Not YouTube: the channel rule drops it.
        {
          utm_source: "facebook",
          utm_campaign: "zach",
          day: "2026-09-01",
          sessions: 40,
        },
      ],
      lead_page_views: [
        {
          utm_source: "youtube",
          utm_campaign: "zach",
          occurred_at: "2026-09-10T00:00:00.000Z",
        },
      ],
    });

    expect(result.totals.visits).toBe(569);
    expect(result.coverage.visitsSource).toBe("ga4");
    expect(calls.ga4_page_views).toContainEqual({
      method: "neq",
      args: ["utm_campaign", "(not set)"],
    });
  });

  it("falls back to the site's own visits until GA4 has synced", async () => {
    const view = {
      utm_source: "youtube",
      utm_campaign: "zach",
      occurred_at: "2026-09-10T00:00:00.000Z",
    };

    const { result } = await run({ lead_page_views: [view, view] });

    expect(result.totals.visits).toBe(2);
    expect(result.coverage.visitsSource).toBe("site");
  });

  it("reports visits as unmeasured when the GA4 read fails, not the site's short history", async () => {
    const view = {
      utm_source: "youtube",
      utm_campaign: "zach",
      occurred_at: "2026-09-10T00:00:00.000Z",
    };

    const { result } = await run({ lead_page_views: [view] }, [
      "ga4_page_views",
    ]);

    expect(result.totals.visits).toBeNull();
    expect(result.coverage.visitsConnected).toBe(false);
    expect(result.coverage.visitsSource).toBeNull();
  });

  it("logs a read that timed out instead of calling it not connected", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await run({}, [], {
      ga4_page_views: { code: "57014", message: "statement timeout" },
    });

    // Still unmeasured, never zero...
    expect(result.totals.visits).toBeNull();
    // ...but a timeout is an outage, and it is said out loud.
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("ga4_page_views read failed (57014)"),
    );
    error.mockRestore();
  });

  it("stays quiet about a table that is simply not there yet", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await run({}, [], {
      ga4_page_views: { code: "42P01", message: "relation does not exist" },
    });

    expect(result.coverage.visitsConnected).toBe(false);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  async function run(
    rows: Record<string, unknown[]>,
    failing: string[] = [],
    errors: Record<string, unknown> = {},
  ) {
    const { client, calls, inFlight } = buildClient(
      {
        lead_submissions: [],
        youtube_videos: [],
        bitly_link_clicks: [],
        lead_page_views: [],
        ga4_page_views: [],
        ...rows,
      },
      failing,
      errors,
    );
    const result = await getYouTubeAttribution({ client, now: NOW });
    return { result, calls, inFlight };
  }
});
