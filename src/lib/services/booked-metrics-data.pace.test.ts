import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENT_TYPE_ENTRIES } from "@/lib/services/calendly-event-class";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the test must pass its own client");
  },
}));

const { getBookedPace } = await import("./booked-metrics-data");

/**
 * `getBookedPace` end to end over fake tables: the day boundary, the grid
 * windows, the "unreadable is not zero" rule, and the first-form channel
 * lookup. booked-metrics.test.ts covers the pure counting; this is the loader
 * the Goals page actually calls.
 */

const NEW_CALL = EVENT_TYPE_ENTRIES.find((entry) => entry.class === "new")!;

type Row = Record<string, unknown>;
type TableSpec = { rows?: Row[]; error?: { message: string; code?: string } };

function fakeClient(tables: Record<string, TableSpec>) {
  const reads: string[] = [];
  const client = {
    from(table: string) {
      reads.push(table);
      const spec = tables[table] ?? { rows: [] };
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "gte", "not", "eq", "order"]) {
        chain[method] = () => chain;
      }
      chain.range = (from: number, to: number) =>
        Promise.resolve(
          spec.error
            ? { data: null, count: null, error: spec.error }
            : {
                data: (spec.rows ?? []).slice(from, to + 1),
                count: (spec.rows ?? []).length,
                error: null,
              },
        );
      return chain;
    },
  } as never;
  return { client, reads };
}

function booking(overrides: Row = {}): Row {
  return {
    invitee_email: "buyer@example.com",
    status: "booked",
    scheduled_event_name: NEW_CALL.name,
    event_start_at: "2026-09-24T15:00:00.000Z",
    utm_source: null,
    utm_medium: null,
    bookedAt: "2026-09-22T14:00:00.000Z",
    eventTypeUri: NEW_CALL.eventTypeUris[0] ?? null,
    ...overrides,
  };
}

// 2:00pm Eastern on 2026-09-22.
const NOW = new Date("2026-09-22T18:00:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getBookedPace", () => {
  it("counts the day in the business timezone, not UTC", async () => {
    // 01:00 UTC on 9/23 is 9pm Eastern on 9/22.
    const { client } = fakeClient({
      calendly_bookings: {
        rows: [
          // Booked 9pm Eastern on 9/22: UTC says 9/23.
          booking({ bookedAt: "2026-09-23T01:00:00.000Z" }),
          // Booked 9am Eastern on 9/22.
          booking({
            invitee_email: "b@example.com",
            bookedAt: "2026-09-22T13:00:00.000Z",
          }),
        ],
      },
    });

    const pace = await getBookedPace({
      client,
      now: new Date("2026-09-23T01:30:00.000Z"),
    });

    expect(pace.day).toBe("2026-09-22");
    expect(pace.timeZone).toBe("America/New_York");
    expect(pace.newBooked.value).toBe(2);
  });

  it("returns a 14-day trailing series ending today, a 14-day booked grid, and a 15-day capacity grid", async () => {
    const { client } = fakeClient({ calendly_bookings: { rows: [booking()] } });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.trailing).toHaveLength(14);
    expect(pace.trailing.at(-1)).toEqual({ day: "2026-09-22", value: 1 });
    expect(pace.trailing[0].day).toBe("2026-09-09");
    expect(pace.booked?.days).toHaveLength(14);
    expect(pace.booked?.days.at(-1)).toBe("2026-09-22");
    expect(pace.capacity?.days).toHaveLength(15);
    expect(pace.capacity?.days[0]).toBe("2026-09-15");
    expect(pace.capacity?.days[7]).toBe("2026-09-22");
    expect(pace.capacity?.days.at(-1)).toBe("2026-09-29");
    expect(pace.connected).toBe(true);
  });

  it("honours a custom trailing length", async () => {
    const { client } = fakeClient({ calendly_bookings: { rows: [] } });

    const pace = await getBookedPace({ client, now: NOW, trailingDays: 3 });

    expect(pace.trailing.map((entry) => entry.day)).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
    ]);
  });

  it("keeps the booked grid, the trailing series and the headline number in agreement", async () => {
    const { client } = fakeClient({
      calendly_bookings: {
        rows: [
          booking({ bookedAt: "2026-09-22T14:00:00.000Z" }),
          booking({
            invitee_email: "b@example.com",
            bookedAt: "2026-09-22T15:00:00.000Z",
          }),
          booking({
            invitee_email: "c@example.com",
            bookedAt: "2026-09-21T15:00:00.000Z",
          }),
          booking({
            invitee_email: "d@example.com",
            bookedAt: "2026-09-21T15:00:00.000Z",
            status: "canceled",
          }),
        ],
      },
      close_lead_funnel: {
        rows: [
          {
            email: "b@example.com",
            funnel: "YouTube",
            first_sales_call_booked_date: null,
          },
        ],
      },
    });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.newBooked.value).toBe(2);
    expect(pace.trailing.at(-1)?.value).toBe(2);
    expect(pace.trailing.at(-2)?.value).toBe(2); // the cancellation still counts as booked
    expect(pace.booked!.totals.at(-1)).toBe(pace.newBooked.value);
    // Both span the same 14 days, so they agree day by day, not just today.
    expect(pace.booked!.totals).toEqual(
      pace.trailing.map((entry) => entry.value),
    );
  });

  it("gives null, never zero, for every number it cannot read when the bookings table fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      calendly_bookings: {
        error: { message: "permission denied", code: "42501" },
      },
    });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.connected).toBe(false);
    expect(pace.booked).toBeNull();
    expect(pace.capacity).toBeNull();
    expect(pace.trailing.every((entry) => entry.value === null)).toBe(true);
  });

  // /admin/goals tells the reader "every number below shows a dash (no data)
  // rather than zero" when `connected` is false, and the trailing series and
  // both grids do. The headline `newBooked` is the exception: it is computed
  // from the empty input rather than nulled, so the "New calls booked" panel
  // reads 0 (and "-25 against goal") during an outage, which is exactly the
  // broken-read-looks-like-an-empty-day case the rest of the loader avoids.
  // Left as-is: counting logic is off limits for behaviour changes here.
  it.fails(
    "shows no headline number when the tables could not be read",
    async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { client } = fakeClient({
        calendly_bookings: {
          error: { message: "permission denied", code: "42501" },
        },
      });

      const pace = await getBookedPace({ client, now: NOW });

      expect(pace.newBooked.value).toBeNull();
    },
  );

  it("documents today's behaviour for that outage: the headline reads 0", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      calendly_bookings: {
        error: { message: "permission denied", code: "42501" },
      },
    });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.connected).toBe(false);
    expect(pace.newBooked.value).toBe(0);
  });

  it("is disconnected when the Close mirror fails too, even if bookings read fine", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      calendly_bookings: { rows: [booking()] },
      close_lead_funnel: { error: { message: "boom" } },
    });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.connected).toBe(false);
    expect(pace.trailing.every((entry) => entry.value === null)).toBe(true);
  });

  it("stays connected without website forms, and says tag credit is short", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      calendly_bookings: { rows: [booking()] },
      lead_submissions: { error: { message: "boom" } },
    });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.connected).toBe(true);
    expect(pace.siteFormsRead).toBe(false);
    expect(pace.booked).not.toBeNull();
    expect(pace.newBooked.value).toBe(1);
  });

  it("logs the failing table with its code but not the row data", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      calendly_bookings: {
        error: { message: "permission denied", code: "42501" },
      },
    });

    await getBookedPace({ client, now: NOW });

    expect(error).toHaveBeenCalledWith("calendly_bookings read failed", {
      code: "42501",
      message: "permission denied",
    });
  });

  describe("channel credit from the first website form", () => {
    it("uses a person's FIRST form when Close has no funnel and the booking has no tag", async () => {
      const { client } = fakeClient({
        calendly_bookings: {
          rows: [booking({ invitee_email: "Buyer@Example.com " })],
        },
        lead_submissions: {
          rows: [
            {
              email: " BUYER@example.com",
              utm_source: "youtube",
              utm_medium: null,
              metadata: {},
            },
            {
              email: "buyer@example.com",
              utm_source: "instagram",
              utm_medium: null,
              metadata: {},
            },
          ],
        },
      });

      const pace = await getBookedPace({ client, now: NOW });

      expect(pace.booked?.channels.map((row) => row.key)).toEqual(["youtube"]);
      expect(pace.booked?.creditedFromTags).toBe(1);
    });

    it("reads an untagged chatbot capture as Website", async () => {
      const { client } = fakeClient({
        calendly_bookings: { rows: [booking()] },
        lead_submissions: {
          rows: [
            {
              email: "buyer@example.com",
              utm_source: null,
              utm_medium: null,
              metadata: { source: "chatbot" },
            },
          ],
        },
      });

      const pace = await getBookedPace({ client, now: NOW });

      expect(pace.booked?.channels.map((row) => row.key)).toEqual(["website"]);
    });

    it("lets Close's funnel win over the website form", async () => {
      const { client } = fakeClient({
        calendly_bookings: { rows: [booking()] },
        close_lead_funnel: {
          rows: [
            {
              email: "buyer@example.com",
              funnel: "Internal Webinar",
              first_sales_call_booked_date: null,
            },
          ],
        },
        lead_submissions: {
          rows: [
            {
              email: "buyer@example.com",
              utm_source: "youtube",
              utm_medium: null,
              metadata: {},
            },
          ],
        },
      });

      const pace = await getBookedPace({ client, now: NOW });

      expect(pace.booked?.channels.map((row) => row.key)).toEqual(["webinar"]);
      expect(pace.booked?.creditedFromTags).toBe(0);
    });
  });

  it("pages through more than a thousand bookings without dropping or doubling any", async () => {
    const many = Array.from({ length: 2500 }, (_, index) =>
      booking({ invitee_email: `p${index}@example.com` }),
    );
    const { client } = fakeClient({ calendly_bookings: { rows: many } });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.newBooked.value).toBe(2500);
  });

  it("reports how much of the event-type mapping is still unreviewed", async () => {
    const { client } = fakeClient({ calendly_bookings: { rows: [] } });

    const pace = await getBookedPace({ client, now: NOW });

    expect(pace.review).toEqual(
      expect.objectContaining({ total: expect.any(Number) }),
    );
  });
});
