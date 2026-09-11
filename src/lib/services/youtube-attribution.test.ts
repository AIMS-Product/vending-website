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
function builder(rows: unknown[], error: unknown) {
  const calls: Call[] = [];
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
  target.then = (resolve: unknown, reject: unknown) =>
    Promise.resolve({
      data: error ? null : window ? rows.slice(window[0], window[1] + 1) : rows,
      error,
    }).then(
      resolve as (v: unknown) => unknown,
      reject as (e: unknown) => unknown,
    );
  return { target, calls };
}

function buildClient(
  rows: Record<string, unknown[]>,
  failing: string[],
  /**
   * Errors to hand back per `from(table)` call, in order. Lets a test fail the
   * first `lead_submissions` select (the one carrying the outcome columns) and
   * let the second through, which is how the two-shot degrade really behaves.
   */
  errorQueue: Record<string, unknown[]> = {},
) {
  const calls: Record<string, Call[]> = {};
  const seen: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    const attempt = seen[table] ?? 0;
    seen[table] = attempt + 1;
    const queued = errorQueue[table]?.[attempt];
    const b = builder(
      rows[table] ?? [],
      queued ?? (failing.includes(table) ? { message: "boom" } : null),
    );
    calls[table] = b.calls;
    return b.target as never;
  });
  return { client: { from } as never, calls };
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

  async function run(
    rows: Record<string, unknown[]>,
    failing: string[] = [],
    errorQueue: Record<string, unknown[]> = {},
  ) {
    const { client, calls } = buildClient(
      {
        lead_submissions: [],
        youtube_videos: [],
        bitly_link_clicks: [],
        lead_page_views: [],
        ga4_page_views: [],
        ...rows,
      },
      failing,
      errorQueue,
    );
    const result = await getYouTubeAttribution({ client, now: NOW });
    return { result, calls };
  }
});

/**
 * H7: a stage that could not be read is unmeasured either way, but "the
 * migration has not been applied" and "the database timed out" are different
 * facts. Only the schema codes mean the former, and the latter must not pass
 * silently.
 */
describe("getYouTubeAttribution read failures", () => {
  const SCHEMA_ERROR = { code: "PGRST205", message: "table not found" };
  const TIMEOUT = {
    code: "57014",
    message: "canceling statement due to statement timeout",
  };

  it("treats a missing table as not connected without logging it as a fault", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await run({}, [], { ga4_page_views: [SCHEMA_ERROR] });

    expect(result.coverage.visitsConnected).toBe(false);
    expect(result.totals.visits).toBeNull();
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("logs a transient read failure instead of calling it not connected in silence", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await run({}, [], { ga4_page_views: [TIMEOUT] });

    // Still unmeasured: null, never a fabricated zero.
    expect(result.totals.visits).toBeNull();
    expect(logged).toHaveBeenCalledTimes(1);
    const message = String(logged.mock.calls[0]?.[0]);
    expect(message).toContain("57014");
    expect(message).toContain("ga4_page_views");
    logged.mockRestore();
  });

  it("logs a transient failure on the outcome columns rather than blaming the migration", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const lead = {
      id: "l1",
      created_at: "2026-09-05T00:00:00.000Z",
      email: "viewer@realprospect.com",
      utm_source: "youtube",
      utm_campaign: "zach",
      utm_content: null,
      lifecycle_status: "new",
      call_booked_at: null,
      metadata: null,
    };

    // First lead_submissions select (with the outcome columns) times out; the
    // base-column retry succeeds.
    const { result } = await run({ lead_submissions: [lead] }, [], {
      lead_submissions: [TIMEOUT],
    });

    expect(result.totals.leads).toBe(1);
    expect(result.coverage.outcomesConnected).toBe(false);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0]?.[0])).toContain("57014");
    logged.mockRestore();
  });

  it("does not log when the outcome columns are simply absent", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await run({}, [], {
      lead_submissions: [{ code: "42703", message: "no column" }],
    });

    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  async function run(
    rows: Record<string, unknown[]>,
    failing: string[] = [],
    errorQueue: Record<string, unknown[]> = {},
  ) {
    const { client } = buildClient(
      {
        lead_submissions: [],
        youtube_videos: [],
        bitly_link_clicks: [],
        lead_page_views: [],
        ga4_page_views: [],
        ...rows,
      },
      failing,
      errorQueue,
    );
    return { result: await getYouTubeAttribution({ client, now: NOW }) };
  }
});
