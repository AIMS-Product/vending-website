import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/services/booked-calls-v2-data", () => ({
  getBookedCallsV2: vi.fn(),
}));
vi.mock("@/lib/services/data-report", () => ({ pacificStartIso: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/close/client", () => ({ createCloseClient: vi.fn() }));
import {
  aggregateProduction,
  weekDays,
  assertPublishedGeneration,
} from "./booking-production-v2";
import type { Decision } from "@/lib/booked-calls-v2/engine";
const row = (id: string, bucket: Decision["bookedBy"], day: string) =>
  ({
    meetingId: id,
    createdDay: day,
    disposition: "counted",
    bookedBy: bucket,
    origin: { source: "YouTube" },
  }) as Decision;
describe("shared V2 aggregate", () => {
  it("counts Sunday by creation day in all buckets; weekly marketing goal remains separate", () => {
    const r = aggregateProduction(
      [
        row("m", "Marketing", "2026-10-25"),
        row("l", "Lane 2", "2026-10-25"),
        row("d", "Social DMs", "2026-10-25"),
      ],
      new Date("2026-10-26T06:59:00Z"),
    );
    expect(r.day).toBe("2026-10-25");
    expect(r.total).toBe(1);
    expect(r.buckets).toEqual({ Marketing: 1, "Lane 2": 1, "Social DMs": 1 });
    expect(r.week.days[6]?.total).toBe(1);
    expect(r.week.end).toBe("2026-10-25");
    expect(r.scorecard.weeks).toHaveLength(5);
  });
  it("resets Monday at Pacific midnight and never fills future days with zero", () => {
    const r = aggregateProduction(
      [row("m", "Marketing", "2026-10-25")],
      new Date("2026-10-26T07:00:00Z"),
    );
    expect(r.week.start).toBe("2026-10-26");
    expect(r.week.total).toBe(0);
    expect(r.week.days[1]?.total).toBeNull();
    expect(r.scorecard.weeks[3]?.total).toBe(1);
  });
  it("calendar arithmetic spans DST", () =>
    expect(weekDays("2026-11-01")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]));
});

it("rejects mixed or unpublished generations despite an unchanged completion marker", () => {
  const done = "2026-10-27T18:00:00.010Z";
  expect(() =>
    assertPublishedGeneration(["2026-10-27T18:00:00.000Z"], done),
  ).not.toThrow();
  for (const stamps of [
    ["2026-10-27T18:00:00Z", "2026-10-27T19:00:00Z"],
    ["2026-10-27T19:00:00Z"],
    ["2026-10-27T17:00:00Z"],
    ["invalid"],
  ])
    expect(() => assertPublishedGeneration(stamps, done)).toThrow();
});

it("returns reconciled historical channel breakdowns without mixing days or buckets", () => {
  const unknown = row("unknown", "Marketing", "2026-10-26");
  unknown.origin.source = null;
  const held = {
    ...row("held", "Marketing", "2026-10-26"),
    disposition: "held",
  } as Decision;
  const report = aggregateProduction(
    [
      row("yesterday", "Marketing", "2026-10-26"),
      unknown,
      held,
      row("lane2", "Lane 2", "2026-10-26"),
      row("today", "Marketing", "2026-10-27"),
      row("prior-week", "Marketing", "2026-10-25"),
    ],
    new Date("2026-10-27T19:00:00Z"),
  );
  const yesterday = report.week.days[0]!;
  expect(yesterday.total).toBe(2);
  expect(yesterday.channels).toEqual([
    { label: "Unknown (Needs Review)", booked: 1 },
    { label: "YouTube", booked: 1 },
  ]);
  expect(yesterday.buckets?.["Lane 2"]).toBe(1);
  expect(yesterday.coverage?.unreviewed).toBe(1);
  expect(report.week.days[1]?.channels).toEqual(report.channels);
  expect(report.week.days[2]?.channels).toBeNull();
  expect(report.week.days[2]?.coverage).toBeNull();
  expect(report.scorecard.weeks[3]?.days[6]?.channels).toEqual([
    { label: "YouTube", booked: 1 },
  ]);
  expect(report.scorecard.weeks[0]?.days[0]?.channels).toEqual([]);
  for (const week of report.scorecard.weeks) {
    for (const day of week.days) {
      if (day.total !== null)
        expect(day.channels?.reduce((n, c) => n + c.booked, 0)).toBe(day.total);
    }
  }
});
