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
 *  - a row-select query: `.select(fields).gte(...).order(...).limit(...)`
 *    resolving `{ data, error }`
 *  - a `count(head:true)` query resolving `{ count, error }`
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
  private rowLimit: number | null = null;

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

  limit(count: number) {
    this.rowLimit = count;
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

    const all = this.tableState.rows.filter((row) =>
      this.filters.every((predicate) => predicate(row)),
    );
    // Honour the limit the way PostgREST does, so a capped read is visible
    // here rather than being silently ignored by the fake.
    const matched = this.rowLimit === null ? all : all.slice(0, this.rowLimit);

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
    email: "prospect@gmail.com",
    full_name: "Real Prospect",
    source_path: "/resources/vending-machine-cost",
    utm_source: "google",
    lifecycle_status: "contact_captured",
    ...overrides,
  };
}

function makeBooking(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "booking_1",
    created_at: "2026-07-15T12:00:00.000Z",
    status: "booked",
    scheduled_event_name: "Discovery call",
    invitee_email: null,
    lead_submission_id: null,
    ...overrides,
  };
}

const NOW = new Date("2026-07-20T12:00:00.000Z");

describe("getAdminAnalytics", () => {
  it("counts leads in the selected window and compares to the prior window", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          // Current 7d window (Jul 13 -> Jul 20).
          makeLead({ id: "c1", created_at: "2026-07-19T12:00:00.000Z" }),
          makeLead({ id: "c2", created_at: "2026-07-15T12:00:00.000Z" }),
          makeLead({ id: "c3", created_at: "2026-07-14T12:00:00.000Z" }),
          // Prior 7d window (Jul 6 -> Jul 13).
          makeLead({ id: "p1", created_at: "2026-07-10T12:00:00.000Z" }),
          makeLead({ id: "p2", created_at: "2026-07-08T12:00:00.000Z" }),
        ],
      },
      calendly_bookings: { rows: [] },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "7d",
    });

    expect(analytics.metrics.leads.value).toBe(3);
    expect(analytics.metrics.leads.prior).toBe(2);
    expect(analytics.metrics.leads.deltaPct).toBe(50);
    expect(analytics.range.days).toBe(7);
  });

  it("reports an absolute change instead of a percentage when the prior window was empty", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [makeLead({ id: "c1", created_at: "2026-07-19T12:00:00.000Z" })],
      },
      calendly_bookings: { rows: [] },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "7d",
    });

    // A percentage against zero is undefined — the UI shows "new · N vs 0".
    expect(analytics.metrics.leads.deltaPct).toBeNull();
    expect(analytics.metrics.leads.value).toBe(1);
    expect(analytics.metrics.leads.prior).toBe(0);
  });

  it("excludes internal and test leads by default and reports how many were hidden", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({
            id: "real",
            email: "buyer@yahoo.com",
            full_name: "Real Buyer",
          }),
          makeLead({ id: "t1", email: "vp-e2e@vendingpreneurs-test.com" }),
          makeLead({ id: "t2", email: "kody@modern-amenities.com" }),
          makeLead({
            id: "t3",
            email: "adam+vpstaging1@aimanagingservices.com",
          }),
          makeLead({
            id: "t4",
            email: "someone@gmail.com",
            full_name: "Stephen Testing 01",
          }),
        ],
      },
      calendly_bookings: { rows: [] },
    });

    const excluded = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });
    expect(excluded.metrics.leads.value).toBe(1);
    expect(excluded.internalExcluded).toBe(4);

    const included = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
      includeInternal: true,
    });
    expect(included.metrics.leads.value).toBe(5);
  });

  it("counts only bookings traceable to a lead toward the booking rate", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({ id: "l1", email: "one@gmail.com" }),
          makeLead({ id: "l2", email: "two@gmail.com" }),
          makeLead({ id: "l3", email: "three@gmail.com" }),
          makeLead({ id: "l4", email: "four@gmail.com" }),
        ],
      },
      calendly_bookings: {
        rows: [
          // Matched by foreign key.
          makeBooking({ id: "b1", lead_submission_id: "l1" }),
          // Matched by invitee email, case-insensitively.
          makeBooking({ id: "b2", invitee_email: "TWO@gmail.com" }),
          // Booked through Saleskick or by phone — real, but not from the site.
          makeBooking({ id: "b3", invitee_email: "walkin@aol.com" }),
          // Cancellations never count.
          makeBooking({
            id: "b4",
            status: "canceled",
            lead_submission_id: "l3",
          }),
        ],
      },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });

    expect(analytics.metrics.bookedFromLeads.value).toBe(2);
    // 2 of 4 leads booked — never the 3/4 that counting the walk-in would give.
    expect(analytics.metrics.bookingRatePct.value).toBe(50);
    expect(analytics.bookingsTotal).toBe(3);
    expect(analytics.bookingsUnattributed).toBe(1);
  });

  it("never reports a booking rate above 100% when outside bookings outnumber leads", async () => {
    // The exact shape of the bug this replaced: 309 bookings / 23 leads = 1343%.
    const client = buildClient({
      lead_submissions: {
        rows: [makeLead({ id: "l1", email: "one@gmail.com" })],
      },
      calendly_bookings: {
        rows: Array.from({ length: 40 }, (_, index) =>
          makeBooking({
            id: `b${index}`,
            invitee_email: `outside${index}@aol.com`,
          }),
        ),
      },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });

    expect(analytics.metrics.bookingRatePct.value).toBe(0);
    expect(analytics.metrics.bookingRatePct.value).toBeLessThanOrEqual(100);
    expect(analytics.bookingsUnattributed).toBe(40);
  });

  it("counts qualified leads from lifecycle status", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({
            id: "q1",
            email: "a@gmail.com",
            lifecycle_status: "qualified",
          }),
          makeLead({
            id: "q2",
            email: "b@gmail.com",
            lifecycle_status: "qualified",
          }),
          makeLead({
            id: "n1",
            email: "c@gmail.com",
            lifecycle_status: "contact_captured",
          }),
        ],
      },
      calendly_bookings: { rows: [] },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });

    expect(analytics.metrics.qualified.value).toBe(2);
    expect(analytics.metrics.leads.value).toBe(3);
  });

  it("limits breakdowns to the top 12 by count", async () => {
    const leads = Array.from({ length: 15 }, (_, index) => {
      const count = index === 0 ? 5 : 1;
      return Array.from({ length: count }, (_, copy) =>
        makeLead({
          id: `l${index}-${copy}`,
          email: `p${index}-${copy}@gmail.com`,
          source_path: `/page-${index}`,
        }),
      );
    }).flat();

    const client = buildClient({
      lead_submissions: { rows: leads },
      calendly_bookings: { rows: [] },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });

    expect(analytics.leadsBySourcePath).toHaveLength(12);
    expect(analytics.leadsBySourcePath[0]).toEqual({
      label: "/page-0",
      count: 5,
    });
  });

  it("labels blank source and utm values rather than dropping them", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({
            id: "l1",
            email: "a@gmail.com",
            source_path: "/apply",
            utm_source: "google",
          }),
          makeLead({
            id: "l2",
            email: "b@gmail.com",
            source_path: null,
            utm_source: null,
          }),
          makeLead({
            id: "l3",
            email: "c@gmail.com",
            source_path: "",
            utm_source: "  ",
          }),
        ],
      },
      calendly_bookings: { rows: [] },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });

    expect(analytics.leadsBySourcePath).toEqual([
      { label: "(direct / unknown)", count: 2 },
      { label: "/apply", count: 1 },
    ]);
    expect(analytics.leadsByUtmSource).toEqual([
      { label: "(none)", count: 2 },
      { label: "google", count: 1 },
    ]);
  });

  it("builds a daily trend covering the range including zero days", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({
            id: "l1",
            email: "a@gmail.com",
            created_at: "2026-07-20T01:00:00.000Z",
          }),
          makeLead({
            id: "l2",
            email: "b@gmail.com",
            created_at: "2026-07-19T23:00:00.000Z",
          }),
        ],
      },
      calendly_bookings: {
        rows: [
          makeBooking({
            id: "b1",
            created_at: "2026-07-20T09:00:00.000Z",
            invitee_email: "a@gmail.com",
          }),
          makeBooking({
            id: "b2",
            created_at: "2026-07-20T10:00:00.000Z",
            status: "canceled",
            invitee_email: "b@gmail.com",
          }),
        ],
      },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "7d",
    });

    expect(analytics.dailyTrend).toHaveLength(7);
    const lastDay = analytics.dailyTrend.at(-1);
    expect(lastDay?.date).toBe("2026-07-20");
    expect(lastDay?.leads).toBe(1);
    // The canceled booking must not appear.
    expect(lastDay?.bookings).toBe(1);
    expect(analytics.dailyTrend[0].leads).toBe(0);
  });

  it("degrades gracefully when calendly_bookings errors (e.g. 42P01, not yet migrated)", async () => {
    const client = buildClient({
      lead_submissions: {
        rows: [
          makeLead({ id: "l1", email: "a@gmail.com" }),
          makeLead({ id: "l2", email: "b@gmail.com" }),
        ],
      },
      calendly_bookings: {
        rows: [],
        error: { code: "42P01", message: "relation does not exist" },
      },
    });

    const analytics = await getAdminAnalytics({
      client,
      now: NOW,
      range: "90d",
    });

    expect(analytics.bookingsConnected).toBe(false);
    expect(analytics.bookingsByCalendar).toEqual([]);
    expect(analytics.metrics.bookedFromLeads.value).toBe(0);
    expect(analytics.metrics.bookingRatePct.value).toBe(0);
    expect(analytics.metrics.leads.value).toBe(2);
  });

  it("throws AdminAnalyticsServiceError when the leads query itself errors", async () => {
    const client = buildClient({
      lead_submissions: { rows: [], error: { message: "connection reset" } },
      calendly_bookings: { rows: [] },
    });

    await expect(
      getAdminAnalytics({ client, now: NOW, range: "90d" }),
    ).rejects.toThrow(AdminAnalyticsServiceError);
  });
});
