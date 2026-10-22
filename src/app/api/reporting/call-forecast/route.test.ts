/** Intended to live beside the proposed route in vending-website. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: { REPORTING_API_KEY: "test-only-key" as string | undefined },
  bookings: [] as Array<Record<string, unknown>> | null,
  funnels: [] as Array<Record<string, unknown>> | null,
}));

vi.mock("@/lib/config", () => ({ config: state.config }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/services/booked-metrics-data", () => ({
  fetchBookings: async () => state.bookings,
  fetchFunnels: async () => state.funnels,
}));

import { GET } from "./route";

const url = "https://www.vendingpreneurs.com/api/reporting/call-forecast";
const authenticated = () =>
  new Request(url, { headers: { Authorization: "Bearer test-only-key" } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T19:00:00Z"));
  state.config.REPORTING_API_KEY = "test-only-key";
  state.bookings = [];
  state.funnels = [];
});

afterEach(() => vi.useRealTimers());

describe("Call Forecast read-only reporting route", () => {
  it("requires authentication", async () => {
    expect((await GET(new Request(url))).status).toBe(401);
  });

  it("reports missing configuration and failed reads without a fake zero", async () => {
    state.config.REPORTING_API_KEY = undefined;
    expect((await GET(authenticated())).status).toBe(503);
    state.config.REPORTING_API_KEY = "test-only-key";
    state.bookings = null;
    expect((await GET(authenticated())).status).toBe(503);
  });

  it("preserves booked-on date, marketing scope, cancellations and channel totals", async () => {
    const booking = (email: string, overrides = {}) => ({
      inviteeEmail: email,
      status: "booked",
      eventName: "Vendingpreneurs Consultation Call",
      eventTypeUri: null,
      bookedAt: "2026-10-20T18:00:00Z",
      eventStartAt: "2026-10-25T18:00:00Z",
      utmSource: null,
      utmMedium: null,
      ...overrides,
    });
    state.bookings = [
      booking("youtube@example.test"),
      booking("cancelled@example.test", { status: "canceled" }),
      booking("lane2@example.test"),
      booking("yesterday@example.test", { bookedAt: "2026-10-20T03:59:00Z" }),
      booking("unknown@example.test"),
      booking("newtype@example.test", { eventName: "Unreviewed event type" }),
      booking("nodate@example.test", { bookedAt: null }),
    ];
    state.funnels = [
      {
        email: "youtube@example.test",
        funnel: "YouTube",
        firstSalesCallBookedDate: "2026-10-25",
      },
      {
        email: "cancelled@example.test",
        funnel: "YouTube",
        firstSalesCallBookedDate: "2026-10-25",
      },
      {
        email: "lane2@example.test",
        funnel: "Reactivation Scrapers",
        firstSalesCallBookedDate: "2026-10-25",
      },
    ];
    const response = await GET(authenticated());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const report = await response.json();
    expect(report).toMatchObject({
      day: "2026-10-20",
      timeZone: "America/New_York",
      basis: "booked-on",
      scope: "marketing",
      cancellationsIncluded: true,
      total: 3,
    });
    expect(
      report.channels.reduce(
        (sum: number, row: { booked: number }) => sum + row.booked,
        0,
      ),
    ).toBe(report.total);
    expect(report.channels).toContainEqual({ label: "YouTube", booked: 2 });
    expect(report.week).toMatchObject({
      start: "2026-10-19",
      end: "2026-10-25",
      total: 4,
      days: [
        { date: "2026-10-19", total: 1 },
        { date: "2026-10-20", total: 3 },
        { date: "2026-10-21", total: null },
        { date: "2026-10-22", total: null },
        { date: "2026-10-23", total: null },
        { date: "2026-10-24", total: null },
        { date: "2026-10-25", total: null },
      ],
      coverage: { unreviewed: 1, undatable: 1, laneTwoExcluded: 1 },
    });
    expect(report.coverage).toMatchObject({
      laneTwoExcluded: 1,
      unreviewed: 1,
      undatable: 1,
      noCloseMatch: 1,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("@example.test");
    expect(serialized).not.toContain("test-only-key");
  });

  it("keeps Sunday in its Eastern week after UTC Monday and the DST change", async () => {
    vi.setSystemTime(new Date("2026-11-02T04:30:00Z"));
    const report = await (await GET(authenticated())).json();
    expect(report.day).toBe("2026-11-01");
    expect(report.week.start).toBe("2026-10-26");
    expect(report.week.end).toBe("2026-11-01");
    expect(report.week.days).toHaveLength(7);
    expect(
      report.week.days.every(
        (row: { total: number | null }) => row.total === 0,
      ),
    ).toBe(true);
  });

  it("resets on Eastern Monday, with future days unknown rather than zero", async () => {
    vi.setSystemTime(new Date("2026-11-02T05:00:00Z"));
    const report = await (await GET(authenticated())).json();
    expect(report.week.start).toBe("2026-11-02");
    expect(report.week.end).toBe("2026-11-08");
    expect(report.week.total).toBe(0);
    expect(
      report.week.days.map((row: { total: number | null }) => row.total),
    ).toEqual([0, null, null, null, null, null, null]);
  });
});
