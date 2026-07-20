import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AdminAnalyticsServiceError,
  getAdminAnalytics,
} from "./admin-analytics";
import type { Database } from "@/types/database";

type AdminAnalyticsClient = Pick<SupabaseClient<Database>, "from">;

type FakeRow = Record<string, unknown>;

type FakeTableState = {
  rows: FakeRow[];
  /** When set, the row-select query for this table resolves with this error. */
  error?: { code?: string; message?: string };
};

type FakeState = Record<string, FakeTableState>;

/**
 * Minimal fake mirroring the two query shapes admin-analytics.ts issues:
 *  - a row-select query: `.select(fields).gte(...).order(...)` resolving
 *    `{ data, error }` (used for leads and bookings, see lead-admin.test.ts)
 *  - a `count(head:true)` query: `.select(fields, { count, head })`
 *    resolving `{ count, error }` (used for leadsAllTime, see
 *    admin-overview.test.ts)
 */
function buildClient(state: FakeState) {
  return {
    from(table: string) {
      const tableState = state[table] ?? { rows: [] };
      return new FakeAnalyticsQuery(tableState);
    },
  } as unknown as AdminAnalyticsClient;
}

class FakeAnalyticsQuery {
  private filters: Array<(row: FakeRow) => boolean> = [];
  private isCountQuery = false;

  constructor(private tableState: FakeTableState) {}

  select(_fields: string, opts?: { count?: "exact"; head?: boolean }) {
    void _fields;
    this.isCountQuery = Boolean(opts?.head);
    return this;
  }

  gte(key: string, value: string) {
    this.filters.push((row) => String(row[key]) >= value);
    return this;
  }

  order(_key: string, _opts?: { ascending?: boolean }) {
    void _key;
    void _opts;
    return this;
  }

  then(
    resolve: (value: {
      data?: FakeRow[] | null;
      count?: number | null;
      error: { code?: string; message?: string } | null;
    }) => void,
  ) {
    if (this.tableState.error) {
      resolve(
        this.isCountQuery
          ? { count: null, error: this.tableState.error }
          : { data: null, error: this.tableState.error },
      );
      return;
    }

    const matched = this.tableState.rows.filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );

    resolve(
      this.isCountQuery
        ? { count: matched.length, error: null }
        : { data: matched, error: null },
    );
  }
}

function makeLead(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "lead_1",
    created_at: "2026-07-15T12:00:00.000Z",
    source_path: "/resources/vending-machine-cost",
    utm_source: "google",
    ...overrides,
  };
}

function makeBooking(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "booking_1",
    created_at: "2026-07-15T12:00:00.000Z",
    status: "booked",
    scheduled_event_name: "Discovery call",
    ...overrides,
  };
}

describe("getAdminAnalytics", () => {
  it("computes totals, booking rate, and top-N breakdowns with null labels", async () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({ id: "l1", source_path: "/apply", utm_source: "google" }),
          makeLead({ id: "l2", source_path: "/apply", utm_source: "google" }),
          makeLead({ id: "l3", source_path: null, utm_source: null }),
          makeLead({ id: "l4", source_path: "", utm_source: "  " }),
        ],
      },
      calendly_bookings: {
        rows: [
          makeBooking({ id: "b1", status: "booked" }),
          makeBooking({ id: "b2", status: "canceled" }),
        ],
      },
    });

    const analytics = await getAdminAnalytics({ client, now });

    expect(analytics.totals).toEqual({
      leads90d: 4,
      leadsAllTime: 4,
      bookings90d: 1,
      bookingRatePct: 25,
    });
    expect(analytics.bookingsConnected).toBe(true);
    expect(analytics.leadsBySourcePath).toEqual([
      { label: "/apply", count: 2 },
      { label: "(direct / unknown)", count: 2 },
    ]);
    expect(analytics.leadsByUtmSource).toEqual([
      { label: "google", count: 2 },
      { label: "(none)", count: 2 },
    ]);
  });

  it("limits breakdowns to the top 12 by count", async () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const leads = Array.from({ length: 15 }, (_, index) => {
      const path = `/page-${index}`;
      // Give page-0 the most hits so we can assert it stays #1 after sorting.
      const count = index === 0 ? 5 : 1;
      return Array.from({ length: count }, (_, copy) =>
        makeLead({ id: `l${index}-${copy}`, source_path: path }),
      );
    }).flat();

    const client = buildClient({
      lead_submissions: { rows: leads },
      calendly_bookings: { rows: [] },
    });

    const analytics = await getAdminAnalytics({ client, now });

    expect(analytics.leadsBySourcePath).toHaveLength(12);
    expect(analytics.leadsBySourcePath[0]).toEqual({
      label: "/page-0",
      count: 5,
    });
  });

  it("builds a 14-day daily trend including zero-days, bucketed by day", async () => {
    const now = new Date("2026-07-20T15:30:00.000Z");
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({ id: "l1", created_at: "2026-07-20T01:00:00.000Z" }),
          makeLead({ id: "l2", created_at: "2026-07-20T23:00:00.000Z" }),
          makeLead({ id: "l3", created_at: "2026-07-13T00:00:00.000Z" }),
        ],
      },
      calendly_bookings: {
        rows: [
          makeBooking({
            id: "b1",
            created_at: "2026-07-20T09:00:00.000Z",
            status: "booked",
          }),
          // Canceled booking must not appear in the trend.
          makeBooking({
            id: "b2",
            created_at: "2026-07-20T10:00:00.000Z",
            status: "canceled",
          }),
        ],
      },
    });

    const analytics = await getAdminAnalytics({ client, now });

    expect(analytics.dailyTrend).toHaveLength(14);
    expect(analytics.dailyTrend[0].date).toBe("2026-07-07");
    expect(analytics.dailyTrend[0]).toEqual({
      date: "2026-07-07",
      leads: 0,
      bookings: 0,
    });
    expect(analytics.dailyTrend.at(-1)).toEqual({
      date: "2026-07-20",
      leads: 2,
      bookings: 1,
    });
    const day13 = analytics.dailyTrend.find((day) => day.date === "2026-07-13");
    expect(day13).toEqual({ date: "2026-07-13", leads: 1, bookings: 0 });
  });

  it("degrades gracefully when calendly_bookings errors (e.g. 42P01, not yet migrated)", async () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const client = buildClient({
      lead_submissions: {
        rows: [makeLead({ id: "l1" }), makeLead({ id: "l2" })],
      },
      calendly_bookings: {
        rows: [],
        error: { code: "42P01", message: "relation does not exist" },
      },
    });

    const analytics = await getAdminAnalytics({ client, now });

    expect(analytics.bookingsConnected).toBe(false);
    expect(analytics.bookingsByCalendar).toEqual([]);
    expect(analytics.totals.bookings90d).toBe(0);
    expect(analytics.totals.bookingRatePct).toBe(0);
    // Leads must still be returned even though bookings failed.
    expect(analytics.totals.leads90d).toBe(2);
    expect(analytics.totals.leadsAllTime).toBe(2);
  });

  it("throws AdminAnalyticsServiceError when the leads query itself errors", async () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const client = buildClient({
      lead_submissions: {
        rows: [],
        error: { message: "connection reset" },
      },
      calendly_bookings: { rows: [] },
    });

    // Both the row-select and the all-time count query hit the same errored
    // table, so either message can win the race inside Promise.all — assert
    // on the dedicated error class instead of a specific message.
    await expect(getAdminAnalytics({ client, now })).rejects.toThrow(
      AdminAnalyticsServiceError,
    );
  });
});
