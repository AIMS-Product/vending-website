import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the test must pass its own client");
  },
}));

const { getYouTubeAttribution, MAX_CLICK_ROWS, MAX_PAGE_VIEW_ROWS } =
  await import("./youtube-attribution");

type Call = { method: string; args: unknown[] };

/**
 * A chainable PostgREST stand-in: every builder method records its call and
 * returns itself, and awaiting it yields the canned result.
 */
function builder(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {};
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
  target.then = (resolve: unknown, reject: unknown) =>
    Promise.resolve(result).then(
      resolve as (v: unknown) => unknown,
      reject as (e: unknown) => unknown,
    );
  return { target, calls };
}

function buildClient(rows: Record<string, unknown[]>) {
  const calls: Record<string, Call[]> = {};
  const from = vi.fn((table: string) => {
    const b = builder({ data: rows[table] ?? [], error: null });
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

  it("caps both unbounded reads", async () => {
    const { calls } = await run({});

    expect(calls.lead_page_views).toContainEqual({
      method: "limit",
      args: [MAX_PAGE_VIEW_ROWS],
    });
    expect(calls.bitly_link_clicks).toContainEqual({
      method: "limit",
      args: [MAX_CLICK_ROWS],
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
    expect(calls.ga4_page_views).toContainEqual({
      method: "limit",
      args: [MAX_PAGE_VIEW_ROWS],
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

  async function run(rows: Record<string, unknown[]>) {
    const { client, calls } = buildClient({
      lead_submissions: [],
      youtube_videos: [],
      bitly_link_clicks: [],
      lead_page_views: [],
      ...rows,
    });
    const result = await getYouTubeAttribution({ client, now: NOW });
    return { result, calls };
  }
});
