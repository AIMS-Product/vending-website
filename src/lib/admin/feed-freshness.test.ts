import { describe, expect, it } from "vitest";
import { feedFreshness, oldestSync } from "./feed-freshness";

const ok = (finishedAt: string) => ({ status: "ok", finishedAt });

describe("oldestSync", () => {
  it("uses the stalest healthy feed, in Pacific time", () => {
    expect(
      oldestSync([ok("2026-09-30T20:00:00Z"), ok("2026-09-30T13:30:00Z")]),
    ).toBe("Sep 30, 6:30 AM PT");
  });

  it("is null when nothing is healthy", () => {
    expect(
      oldestSync([{ status: "failed", finishedAt: "2026-09-30T13:30:00Z" }]),
    ).toBeNull();
  });
});

describe("feedFreshness", () => {
  it("reports no feeds behind when all are ok", () => {
    const result = feedFreshness([ok("2026-09-30T13:30:00Z")]);
    expect(result).toMatchObject({ behind: 0, total: 1 });
    expect(result.since).toBe("Sep 30, 6:30 AM PT");
  });

  it("counts failed, stale, never and empty feeds, not skipped ones", () => {
    const result = feedFreshness([
      ok("2026-09-30T13:30:00Z"),
      { status: "failed", finishedAt: "2026-09-29T01:00:00Z" },
      { status: "stale", finishedAt: "2026-09-20T01:00:00Z" },
      { status: "never", finishedAt: null },
      { status: "empty", finishedAt: "2026-09-30T01:00:00Z" },
      { status: "skipped", finishedAt: "2026-09-30T01:00:00Z" },
    ]);
    expect(result.behind).toBe(4);
    expect(result.total).toBe(6);
    // Failed and stale feeds do not drag the "updated since" time back.
    expect(result.since).toBe("Sep 30, 6:30 AM PT");
  });
});
