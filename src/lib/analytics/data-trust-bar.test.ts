import { describe, expect, it } from "vitest";
import { ANALYTICS_TABS } from "@/components/admin/AnalyticsPanels";
import { GLOSSARY } from "@/components/admin/AnalyticsGlossary";
import {
  AUDIT_MISSING_AFTER_HOURS,
  buildTrustBar,
  CHECK_COVERS,
  FEEDS,
  flagFor,
  judgeAudit,
  judgeFeed,
  TAB_FEEDS,
  unverifiedFlags,
  type AuditCheck,
  type AuditRun,
  type FeedKey,
} from "@/lib/analytics/data-trust-bar";

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
  it("marks a number whose check failed, with the reason and month", () => {
    const flags = unverifiedFlags(
      "mom",
      run([
        check({
          checkId: "mom-revenue",
          label: "Month over month: revenue",
          window: "2026-08-01 to 2026-08-31",
          status: "fail",
          detail: "We show $100; Close says $150.",
        }),
      ]),
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].metric).toBe("revenue");
    expect(flags[0].months).toEqual(["2026-08"]);
    expect(flags[0].reason).toContain("disagreed with");
    expect(flags[0].reason).toContain("Close says $150");
    expect(flagFor(flags, "revenue", "2026-08")).toBeDefined();
    expect(flagFor(flags, "revenue", "2026-07")).toBeUndefined();
    expect(flagFor(flags, "leads", "2026-08")).toBeUndefined();
  });

  it("marks errored and skipped checks too, never passed or warned ones", () => {
    const checks = [
      check({ checkId: "mom-won", status: "error" }),
      check({ checkId: "mom-leads", status: "skipped" }),
      check({ checkId: "mom-revenue", status: "warn" }),
      check({ checkId: "close-first-calls", status: "pass" }),
    ];
    const metrics = unverifiedFlags("mom", run(checks)).map((f) => f.metric);
    expect(metrics.sort()).toEqual(["leads", "won"]);
  });

  it("spreads a check across every tab that shows its number", () => {
    const failed = run([check({ status: "fail" })]);
    expect(unverifiedFlags("mom", failed).map((f) => f.metric)).toEqual([
      "booked",
    ]);
    expect(unverifiedFlags("close", failed).map((f) => f.metric)).toEqual([
      "booked",
    ]);
    expect(unverifiedFlags("overview", failed)).toEqual([]);
    const calendly = run([
      check({ checkId: "calendly-bookings", status: "fail" }),
    ]);
    expect(unverifiedFlags("overview", calendly)).toHaveLength(1);
    expect(unverifiedFlags("booked", calendly)).toHaveLength(1);
  });

  it("flags nothing when there is no run; the bar says so instead", () => {
    expect(unverifiedFlags("mom", null)).toEqual([]);
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
