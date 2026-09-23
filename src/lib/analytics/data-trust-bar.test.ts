import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AnalyticsTabKey } from "@/components/admin/AnalyticsPanels";
import { ANALYTICS_TABS } from "@/components/admin/AnalyticsPanels";
import { GLOSSARY } from "@/components/admin/AnalyticsGlossary";
import {
  AUDIT_MISSING_AFTER_HOURS,
  buildTrustBar,
  CHECK_COVERS,
  expectedWindow,
  FEEDS,
  flagFor,
  judgeAudit,
  judgeFeed,
  monthRange,
  TAB_FEEDS,
  unverifiedFlags,
  type AuditCheck,
  type AuditRun,
  type FeedKey,
} from "@/lib/analytics/data-trust-bar";
import { settledWindow } from "@/lib/services/data-audit-checks";
import { lastClosedMonth } from "@/lib/services/data-audit-mom-checks";

const NOW = new Date("2026-09-22T18:00:00Z");
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const check = (over: Partial<AuditCheck> = {}): AuditCheck => ({
  checkId: "close-first-calls",
  label: "First calls booked (before exclusions)",
  window: "2026-09-15 to 2026-09-21",
  status: "pass",
  detail: "Matches.",
  ...over,
});

const run = (checks: AuditCheck[], ageHours = 6): AuditRun => ({
  runAt: hoursAgo(ageHours),
  checks,
});

describe("tab to feed mapping", () => {
  it("covers every analytics tab and /admin/data", () => {
    for (const tab of ANALYTICS_TABS) {
      expect(TAB_FEEDS[tab.key].length).toBeGreaterThan(0);
    }
    expect([...TAB_FEEDS.data].sort()).toEqual(Object.keys(FEEDS).sort());
  });

  it("names only feeds that exist, once each", () => {
    for (const feeds of Object.values(TAB_FEEDS)) {
      for (const feed of feeds) expect(FEEDS).toHaveProperty(feed);
      expect(new Set(feeds).size).toBe(feeds.length);
    }
  });

  it("reads the Close mirror on every sales tab", () => {
    for (const tab of ["booked", "close", "mom"] as const) {
      expect(TAB_FEEDS[tab]).toContain("close");
    }
    expect(TAB_FEEDS.overview).toEqual(["site-leads", "calendly"]);
  });

  it("maps checks only to tabs that exist", () => {
    const keys = new Set<string>(ANALYTICS_TABS.map((tab) => tab.key));
    for (const cover of CHECK_COVERS) expect(keys.has(cover.tab)).toBe(true);
  });
});

describe("tab to feed mapping matches what each loader reads", () => {
  /**
   * The service files each tab's data comes from (the loader and the helpers
   * it calls that select from tables). Adding a table read to one of these
   * files without adding its feed to TAB_FEEDS fails here.
   */
  const LOADERS: Record<AnalyticsTabKey, readonly string[]> = {
    overview: ["admin-analytics"],
    acquisition: ["admin-analytics"],
    pages: ["admin-analytics"],
    quality: ["admin-analytics"],
    journeys: ["channel-journeys-data"],
    map: ["funnel-map"],
    channels: ["channel-report", "close-wins"],
    youtube: ["youtube-attribution"],
    video: [
      "video-engagement-report",
      "pre-call-engagement",
      "call-credit-data",
    ],
    booked: ["booked-calls-data"],
    close: ["close-week-view-data", "close-mtd-funnel-data", "close-wins"],
    mom: ["close-monthly-funnel-data", "close-monthly-leads", "close-wins"],
    exec: ["funnel-executive", "funnel-monthly-data", "close-wins"],
    kpi: ["kpi-report-data", "call-credit-data", "channel-report"],
    funnels: ["funnel-monthly-data"],
  };

  /** Table read -> the feed that keeps it current. */
  const TABLE_FEED: Record<string, FeedKey | "spine"> = {
    lead_submissions: "site-leads",
    calendly_bookings: "calendly",
    ga4_page_views: "ga4-pages",
    lead_video_views: "video-views",
    close_lead_funnel: "close",
    bitly_link_clicks: "bitly",
    youtube_videos: "youtube",
    webinar_events: "webinar",
    ghl_email_stats: "ghl-email",
    metricool_posts: "metricool-posts",
    // Written by many connectors; the tab must list at least one of them.
    channel_daily: "spine",
  };

  /** Read, but not a data feed with a schedule of its own. */
  const NOT_FEEDS = new Set([
    "channel_sync_runs", // the health log itself
    "marketing_links", // a registry edited by hand
    "qualification_sessions", // written with the lead it belongs to
    "lead_page_views", // written live by the site's page tracker
    "chatbot_conversations", // written live by the chatbot
  ]);

  const SPINE_FEEDS = new Set<FeedKey>([
    "ga4-visits",
    "spine-leads",
    "ghl-forms",
    "ghl-email",
    "bitly",
    "metricool-posts",
    "metricool-ads",
    "youtube",
    "search-console",
    "webinar",
    "manychat",
  ]);

  const tablesIn = (file: string) => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/services", `${file}.ts`),
      "utf8",
    );
    return [...source.matchAll(/\.from\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
  };

  for (const [tab, files] of Object.entries(LOADERS)) {
    it(`${tab} lists a feed for every table its loader reads`, () => {
      const feeds = TAB_FEEDS[tab as AnalyticsTabKey];
      for (const table of files.flatMap(tablesIn)) {
        if (NOT_FEEDS.has(table)) continue;
        const feed = TABLE_FEED[table];
        expect(feed, `${tab} reads ${table}, which has no feed`).toBeDefined();
        if (feed === "spine") {
          expect(
            feeds.some((f) => SPINE_FEEDS.has(f)),
            `${tab} reads channel_daily but lists no spine feed`,
          ).toBe(true);
        } else {
          expect(feeds, `${tab} reads ${table}`).toContain(feed);
        }
      }
    });
  }
});

describe("feed staleness", () => {
  const feed: FeedKey = "ga4-visits"; // daily, 36h

  it("is current inside its cadence", () => {
    const verdict = judgeFeed({ feed, lastSuccessAt: hoursAgo(20) }, NOW);
    expect(verdict.tone).toBe("ok");
    expect(verdict.problem).toBeNull();
  });

  it("turns amber past its cadence and red past twice it", () => {
    expect(judgeFeed({ feed, lastSuccessAt: hoursAgo(40) }, NOW).tone).toBe(
      "warn",
    );
    const red = judgeFeed({ feed, lastSuccessAt: hoursAgo(80) }, NOW);
    expect(red.tone).toBe("bad");
    expect(red.problem).toBe("last updated 3 days ago");
  });

  it("holds hourly feeds to hours, not days", () => {
    expect(
      judgeFeed({ feed: "close", lastSuccessAt: hoursAgo(4) }, NOW).tone,
    ).toBe("warn");
    expect(
      judgeFeed({ feed: "close", lastSuccessAt: hoursAgo(7) }, NOW).tone,
    ).toBe("bad");
  });

  it("is red when a feed never updated or could not be read", () => {
    expect(judgeFeed({ feed, lastSuccessAt: null }, NOW).tone).toBe("bad");
    const unread = judgeFeed(
      { feed, lastSuccessAt: hoursAgo(1), error: "timeout" },
      NOW,
    );
    expect(unread.tone).toBe("bad");
    expect(unread.problem).toContain("timeout");
  });

  it("says not connected, instead of a date, when the feed's table is empty", () => {
    // ManyChat's only run on record was our own test; no event ever arrived.
    const verdict = judgeFeed(
      { feed: "manychat", lastSuccessAt: hoursAgo(300), connected: false },
      NOW,
    );
    expect(verdict.connected).toBe(false);
    expect(verdict.problem).toContain("never sent an event");
  });

  it("names why from a skipped run, and keeps a failing run a failure", () => {
    const skipped = judgeFeed(
      {
        feed: "bitly",
        lastSuccessAt: null,
        connected: false,
        status: "skipped",
        note: "BITLY_ACCESS_TOKEN is not set.",
      },
      NOW,
    );
    expect(skipped.connected).toBe(false);
    expect(skipped.problem).toBe(
      "no click has ever been stored: BITLY_ACCESS_TOKEN is not set",
    );

    // A token that is set but refused: the table stays empty, the run fails.
    const failing = judgeFeed(
      {
        feed: "bitly",
        lastSuccessAt: null,
        connected: false,
        status: "failed",
        note: "Bitly 403",
      },
      NOW,
    );
    expect(failing.connected).toBe(true);
    expect(failing.tone).toBe("bad");
  });

  it("ignores connected: false on a feed with no table of its own", () => {
    const verdict = judgeFeed(
      { feed, lastSuccessAt: hoursAgo(80), connected: false },
      NOW,
    );
    expect(verdict.connected).toBe(true);
    expect(verdict.tone).toBe("bad");
  });

  it("keeps a not-connected feed out of the tab's date and tone", () => {
    const bar = buildTrustBar({
      scope: "journeys",
      feeds: TAB_FEEDS.journeys.map((f) =>
        f === "bitly"
          ? { feed: f, lastSuccessAt: hoursAgo(8), connected: false }
          : { feed: f, lastSuccessAt: hoursAgo(1) },
      ),
      run: null,
      now: NOW,
    });
    expect(bar.freshnessTone).toBe("ok");
    expect(bar.asOf).toBe(hoursAgo(1));
    expect(bar.problems).toEqual([]);
    expect(bar.feedCount).toBe(TAB_FEEDS.journeys.length - 1);
    expect(bar.notConnected.map((v) => v.feed)).toEqual(["bitly"]);
  });

  it("still dates a feed as stale once its table has data", () => {
    const bar = buildTrustBar({
      scope: "journeys",
      feeds: TAB_FEEDS.journeys.map((f) => ({
        feed: f,
        lastSuccessAt: f === "bitly" ? hoursAgo(8) : hoursAgo(1),
      })),
      run: null,
      now: NOW,
    });
    expect(bar.notConnected).toEqual([]);
    expect(bar.problems.map((v) => v.feed)).toEqual(["bitly"]);
  });

  it("is amber when a fresh feed runs but adds nothing", () => {
    const verdict = judgeFeed(
      { feed: "bitly", lastSuccessAt: hoursAgo(1), status: "empty" },
      NOW,
    );
    expect(verdict.tone).toBe("warn");
    expect(verdict.problem).toBe("runs but adds no new data");
  });

  it("dates a tab by its oldest feed and names the stale one", () => {
    const bar = buildTrustBar({
      scope: "overview",
      feeds: [
        { feed: "site-leads", lastSuccessAt: hoursAgo(2) },
        { feed: "calendly", lastSuccessAt: hoursAgo(30) },
        // Not an overview feed: must not affect it.
        { feed: "manychat", lastSuccessAt: null },
      ],
      run: run([check()]),
      now: NOW,
    });
    expect(bar.asOf).toBe(hoursAgo(30));
    expect(bar.freshnessTone).toBe("warn");
    expect(bar.problems.map((p) => p.label)).toEqual(["Calendly bookings"]);
    expect(bar.feedCount).toBe(2);
  });

  it("treats a feed the reader never reported as never updated", () => {
    const bar = buildTrustBar({
      scope: "booked",
      feeds: [{ feed: "calendly", lastSuccessAt: hoursAgo(1) }],
      run: run([check()]),
      now: NOW,
    });
    expect(bar.asOf).toBeNull();
    expect(bar.freshnessTone).toBe("bad");
    expect(bar.problems[0].feed).toBe("close");
  });
});

describe("last night's audit", () => {
  it("counts passes and names every check that did not pass, worst first", () => {
    const verdict = judgeAudit(
      run([
        check({ checkId: "a", label: "A" }),
        check({ checkId: "b", label: "B", status: "skipped" }),
        check({ checkId: "c", label: "C", status: "fail" }),
      ]),
      NOW,
    );
    expect(verdict.passed).toBe(1);
    expect(verdict.total).toBe(3);
    expect(verdict.notPassed.map((c) => c.label)).toEqual(["C", "B"]);
    expect(verdict.tone).toBe("bad");
  });

  it("is green only when every check passed on a run from last night", () => {
    expect(judgeAudit(run([check()]), NOW).tone).toBe("ok");
    expect(judgeAudit(run([check({ status: "warn" })]), NOW).tone).toBe("warn");
  });

  it("is red when no run is stored", () => {
    const verdict = judgeAudit(null, NOW);
    expect(verdict.tone).toBe("bad");
    expect(verdict.ranLastNight).toBe(false);
  });

  it("is red when the newest run is older than 26 hours, even if it passed", () => {
    const verdict = judgeAudit(
      run([check()], AUDIT_MISSING_AFTER_HOURS + 1),
      NOW,
    );
    expect(verdict.ranLastNight).toBe(false);
    expect(verdict.tone).toBe("bad");
  });

  it("is red when the checks could not be read", () => {
    const verdict = judgeAudit(null, NOW, "permission denied");
    expect(verdict.tone).toBe("bad");
    expect(verdict.error).toBe("permission denied");
  });

  it("is red when a run holds no checks at all", () => {
    expect(judgeAudit(run([]), NOW).tone).toBe("bad");
  });
});

describe("unverified numbers", () => {
  /** Every covered check passing, so each test only varies what it names. */
  const allPass = () =>
    [...new Set(CHECK_COVERS.map((cover) => cover.checkId))].map((id) =>
      check({ checkId: id, label: id }),
    );
  const without = (ids: string[], extra: AuditCheck[] = []) =>
    run([...allPass().filter((c) => !ids.includes(c.checkId)), ...extra]);

  it("marks nothing when every covered check passed last night", () => {
    for (const tab of ["mom", "close", "overview", "booked"] as const) {
      expect(unverifiedFlags(tab, run(allPass()), NOW)).toEqual([]);
    }
  });

  it("marks a number whose check failed, with the reason and its days", () => {
    const flags = unverifiedFlags(
      "mom",
      without(
        ["mom-revenue"],
        [
          check({
            checkId: "mom-revenue",
            label: "Month over month: revenue",
            window: "2026-08-01 to 2026-08-31",
            status: "fail",
            detail: "We show $100; Close says $150.",
          }),
        ],
      ),
      NOW,
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      metric: "revenue",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(flags[0].reason).toContain("disagreed with");
    expect(flags[0].reason).toContain("Close says $150");
    expect(flagFor(flags, "revenue", monthRange("2026-08"))).toBeDefined();
    expect(flagFor(flags, "revenue", monthRange("2026-07"))).toBeUndefined();
    expect(flagFor(flags, "revenue", monthRange("2026-09"))).toBeUndefined();
    expect(flagFor(flags, "leads", monthRange("2026-08"))).toBeUndefined();
  });

  it("marks errored and skipped checks, never passed or warned ones", () => {
    const flags = unverifiedFlags(
      "mom",
      without(
        ["mom-won", "mom-leads", "mom-revenue"],
        [
          check({ checkId: "mom-won", status: "error" }),
          check({ checkId: "mom-leads", status: "skipped" }),
          check({ checkId: "mom-revenue", status: "warn" }),
        ],
      ),
      NOW,
    );
    expect(flags.map((f) => f.metric).sort()).toEqual(["leads", "won"]);
  });

  it("marks a covered check missing from the run as not checked", () => {
    const flags = unverifiedFlags("close", without(["close-first-calls"]), NOW);
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toContain("missing from the latest audit run");
    // Window the check would have compared, from the run's own time.
    expect(flags[0]).toMatchObject({ from: "2026-09-15", to: "2026-09-21" });
  });

  it("marks MoM numbers when the whole month-over-month group crashed", () => {
    const flags = unverifiedFlags(
      "mom",
      without(
        ["mom-won", "mom-revenue", "mom-leads"],
        [
          check({
            checkId: "mom-group",
            label: "mom",
            window: "the checked window",
            status: "error",
            detail: "Close timed out.",
          }),
        ],
      ),
      NOW,
    );
    expect(flags.map((f) => f.metric).sort()).toEqual([
      "leads",
      "revenue",
      "won",
    ]);
    expect(flags[0].reason).toContain("Close timed out.");
    // Stored window has no dates, so the expected one is used: last month.
    expect(flags[0]).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("marks MoM numbers when Close is not configured and the group stored nothing", () => {
    const flags = unverifiedFlags(
      "mom",
      without(
        ["mom-won", "mom-revenue", "mom-leads", "close-first-calls"],
        [
          check({
            checkId: "close-config",
            label: "First calls checked against Close",
            status: "fail",
            detail: "CLOSE_API_KEY is not set.",
          }),
        ],
      ),
      NOW,
    );
    expect(flags).toHaveLength(4);
    for (const flag of flags) {
      expect(flag.reason).toContain("CLOSE_API_KEY is not set.");
    }
  });

  it("marks Calendly numbers when the token is missing (config row only)", () => {
    const run2 = without(
      ["calendly-bookings"],
      [
        check({
          checkId: "calendly-config",
          label: "Bookings checked against Calendly",
          status: "fail",
          detail: "CALENDLY_API_TOKEN is not set.",
        }),
      ],
    );
    for (const tab of ["overview", "booked"] as const) {
      const flags = unverifiedFlags(tab, run2, NOW);
      expect(flags).toHaveLength(1);
      expect(flags[0].reason).toContain("CALENDLY_API_TOKEN");
    }
  });

  it("marks Calendly numbers when the Calendly group crashed", () => {
    const flags = unverifiedFlags(
      "overview",
      without(
        ["calendly-bookings"],
        [
          check({
            checkId: "calendly-group",
            label: "calendly",
            window: "the checked window",
            status: "error",
            detail: "401",
          }),
        ],
      ),
      NOW,
    );
    expect(flags).toHaveLength(1);
  });

  it("marks every covered number when no run is stored or the run is stale", () => {
    expect(unverifiedFlags("mom", null, NOW)).toHaveLength(4);
    const stale = run(allPass(), AUDIT_MISSING_AFTER_HOURS + 1);
    const flags = unverifiedFlags("close", stale, NOW);
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toContain("Not checked last night");
    const unread = unverifiedFlags("booked", null, NOW, "denied");
    expect(unread[0].reason).toContain("could not be read (denied)");
  });

  it("only matches a displayed range that overlaps the check's days", () => {
    const flags = unverifiedFlags(
      "close",
      without(
        ["close-first-calls"],
        [
          check({
            checkId: "close-first-calls",
            window: "2026-08-25 to 2026-08-31",
            status: "fail",
          }),
        ],
      ),
      NOW,
    );
    // September month-to-date shows no August days: no chip.
    expect(
      flagFor(flags, "booked", { from: "2026-09-01", to: "2026-09-01" }),
    ).toBeUndefined();
    expect(
      flagFor(flags, "booked", { from: "2026-08-01", to: "2026-08-31" }),
    ).toBeDefined();
  });

  it("names the same window the audit itself compares", () => {
    const at = new Date("2026-09-02T12:30:00Z");
    const month = lastClosedMonth(at);
    expect(expectedWindow("last-closed-month", at)).toEqual({
      from: month.from,
      to: month.label.slice(-10),
    });
    const settled = settledWindow(at, 1);
    expect(expectedWindow("last-7-settled-days", at)).toEqual({
      from: settled.from,
      to: settled.to,
    });
  });
});

describe("glossary", () => {
  it("defines every term REPORTING.md fixes", () => {
    const terms = GLOSSARY.map((entry) => entry.term);
    for (const term of [
      "Lead",
      "Site form fills vs total captured",
      "Booked call",
      "Skipped form (direct booking)",
      "Showed",
      "Qualified",
      "Closed-won (CW) and revenue",
    ]) {
      expect(terms).toContain(term);
    }
  });
});
