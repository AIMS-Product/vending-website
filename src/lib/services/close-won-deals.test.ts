import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import {
  daysBetween,
  firstEngagement,
  percentile,
  rollupBySource,
  type WonDeal,
} from "./close-won-deals";

const deal = (
  source: string,
  value: number | null,
  days: number | null,
): WonDeal => ({
  leadId: "l",
  name: null,
  source,
  funnel: null,
  firstTouch: null,
  dateWon: "2026-09-20",
  value,
  closer: null,
  firstEngagedAt: null,
  firstEngagedVia: null,
  daysToClose: days,
});

describe("closed-won", () => {
  it("picks the earliest signal and names it", () => {
    expect(
      firstEngagement({
        "Close lead created": "2026-08-10T00:00:00Z",
        "Site form": "2026-08-01T12:00:00Z",
        Chatbot: undefined,
      }),
    ).toEqual({ at: "2026-08-01T12:00:00Z", via: "Site form" });
    expect(firstEngagement({})).toBeNull();
  });

  it("counts whole days and never goes negative", () => {
    expect(daysBetween("2026-09-01T23:00:00Z", "2026-09-11")).toBe(10);
    expect(daysBetween("2026-09-12T01:00:00Z", "2026-09-11")).toBe(0);
  });

  it("rolls up by source, sorted by revenue, with median and p75", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 75)).toBe(3);
    expect(percentile([], 50)).toBeNull();
    const rows = rollupBySource(
      [deal("Web", 5000, 4), deal("Web", null, 10), deal("YouTube", 9000, 2)],
      new Map([["Web", 4]]),
    );
    expect(rows.map((r) => r.source)).toEqual(["YouTube", "Web"]);
    expect(rows[1]).toMatchObject({
      won: 2,
      revenue: 5000,
      avgDeal: 5000,
      medianDays: 4,
      p75Days: 10,
      shown: 4,
      closeRate: 0.5,
    });
    expect(rows[0].closeRate).toBeNull();
  });
});
