import { describe, expect, it, vi } from "vitest";
import { buildCallCreditReport } from "./call-credit-data";

/**
 * Characterization of `buildCallCreditReport`, the loader behind the booking
 * ledger and the setter leaderboard. Only `fetchChatIndex` was tested before.
 * The credit rule itself (`resolveCallCredit`) is covered in call-credit.test.ts;
 * this pins the loader's own policy: windowing on booked-at, the migration
 * fallback, paging, and Close-mirror-first setter credit.
 */

type Client = Parameters<typeof buildCallCreditReport>[1] extends
  | { client?: infer C }
  | undefined
  ? C
  : never;

type BookingRow = Record<string, unknown>;

function booking(overrides: BookingRow = {}): BookingRow {
  return {
    id: "b1",
    invitee_name: "Jane Buyer",
    invitee_email: "jane@example.com",
    scheduled_event_name: "Discovery Call",
    event_start_at: "2026-09-20T15:00:00.000Z",
    canceled_at: null,
    utm_source: null,
    utm_medium: null,
    utm_content: null,
    lead_submission_id: null,
    invitee_uri: "https://api.calendly.com/scheduled_events/e/invitees/b1",
    booked_at: "2026-09-18T12:00:00.000Z",
    scheduled_by: null,
    hosts: null,
    lead: null,
    ...overrides,
  };
}

type FakeOptions = {
  bookings: BookingRow[];
  closeFunnel?: Array<{ email: string | null; setter_name: string | null }>;
  /** Fail any bookings read whose select string mentions this fragment. */
  failWhenSelectIncludes?: string;
  failAlways?: boolean;
  throwOnBookings?: boolean;
  pageSize?: number;
};

function fakeClient(options: FakeOptions) {
  const selects: string[] = [];
  const ranges: Array<[number, number]> = [];

  const client = {
    from(table: string) {
      if (table === "calendly_bookings") {
        if (options.throwOnBookings) throw new Error("db unreachable");
        let selectArg = "";
        const chain: Record<string, unknown> = {};
        chain.select = (columns: string) => {
          selectArg = columns;
          selects.push(columns);
          return chain;
        };
        for (const method of ["eq", "gte", "lte", "order"]) {
          chain[method] = () => chain;
        }
        chain.range = (from: number, to: number) => {
          ranges.push([from, to]);
          const failing =
            options.failAlways ||
            (options.failWhenSelectIncludes &&
              selectArg.includes(options.failWhenSelectIncludes));
          return Promise.resolve(
            failing
              ? { data: null, error: { message: "column does not exist" } }
              : { data: options.bookings.slice(from, to + 1), error: null },
          );
        };
        return chain;
      }
      if (table === "close_lead_funnel") {
        const rows = options.closeFunnel ?? [];
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "order"]) chain[method] = () => chain;
        chain.range = (from: number, to: number) =>
          Promise.resolve({
            data: rows.slice(from, to + 1),
            count: rows.length,
            error: null,
          });
        return chain;
      }
      if (table === "chatbot_conversations") {
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "not", "order"]) {
          chain[method] = () => chain;
        }
        chain.range = () =>
          Promise.resolve({ data: [], count: 0, error: null });
        return chain;
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as Client;
  return { client, selects, ranges };
}

const WINDOW = {
  startIso: "2026-09-15T00:00:00.000Z",
  endIso: "2026-09-22T00:00:00.000Z",
};

describe("buildCallCreditReport", () => {
  it("windows on when the call was BOOKED, start inclusive and end exclusive", async () => {
    const { client } = fakeClient({
      bookings: [
        booking({ id: "in", booked_at: "2026-09-18T12:00:00.000Z" }),
        booking({ id: "at-start", booked_at: WINDOW.startIso }),
        booking({ id: "at-end", booked_at: WINDOW.endIso }),
        booking({ id: "before", booked_at: "2026-09-14T23:59:59.000Z" }),
        // Call is in the window, but it was booked long before: not counted.
        booking({
          id: "booked-long-ago",
          booked_at: "2026-06-01T00:00:00.000Z",
          event_start_at: "2026-09-20T15:00:00.000Z",
        }),
      ],
    });

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.connected).toBe(true);
    expect(report.since).toBe(WINDOW.startIso);
    expect(report.rows.map((row) => row.id).sort()).toEqual(["at-start", "in"]);
  });

  it("falls back to the call date when a payload has no booked-at, and drops a row with neither", async () => {
    const { client } = fakeClient({
      bookings: [
        booking({
          id: "old-shape",
          booked_at: null,
          event_start_at: "2026-09-17T15:00:00.000Z",
        }),
        booking({ id: "no-dates", booked_at: null, event_start_at: null }),
        booking({
          id: "garbage",
          booked_at: "not a date",
          event_start_at: null,
        }),
      ],
    });

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.rows.map((row) => row.id)).toEqual(["old-shape"]);
  });

  it("sorts newest booking first and flags cancellations without dropping them", async () => {
    const { client } = fakeClient({
      bookings: [
        booking({ id: "older", booked_at: "2026-09-16T12:00:00.000Z" }),
        booking({
          id: "newer",
          booked_at: "2026-09-19T12:00:00.000Z",
          canceled_at: "2026-09-20T00:00:00.000Z",
        }),
      ],
    });

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.rows.map((row) => [row.id, row.canceled])).toEqual([
      ["newer", true],
      ["older", false],
    ]);
  });

  it("retries the read without the setter-touch columns when that migration is unapplied", async () => {
    const { client, selects } = fakeClient({
      bookings: [booking()],
      failWhenSelectIncludes: "setter_touch_name",
    });

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.connected).toBe(true);
    expect(report.rows).toHaveLength(1);
    expect(selects).toHaveLength(2);
    expect(selects[0]).toContain("setter_touch_name");
    expect(selects[1]).not.toContain("setter_touch_name");
    expect(selects[1]).toContain("booked_by_setter");
  });

  it("returns a disconnected, empty report when both reads fail", async () => {
    const { client } = fakeClient({ bookings: [booking()], failAlways: true });

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.connected).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.since).toBe(WINDOW.startIso);
  });

  it("returns a disconnected, empty report when the read throws", async () => {
    const { client } = fakeClient({ bookings: [], throwOnBookings: true });

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.connected).toBe(false);
    expect(report.rows).toEqual([]);
  });

  it("pages past PostgREST's 1,000-row cap and honours the row limit", async () => {
    const many = Array.from({ length: 2300 }, (_, index) =>
      booking({
        id: `b${index}`,
        booked_at: "2026-09-18T12:00:00.000Z",
        invitee_email: `p${index}@example.com`,
      }),
    );
    const { client, ranges } = fakeClient({ bookings: many });

    const all = await buildCallCreditReport({ window: WINDOW }, { client });
    expect(all.rows).toHaveLength(2300);
    expect(ranges.map(([from]) => from)).toEqual([0, 1000, 2000]);

    const capped = fakeClient({ bookings: many });
    const limited = await buildCallCreditReport(
      { window: WINDOW, limit: 1500 },
      { client: capped.client },
    );
    expect(limited.rows).toHaveLength(1500);
    // It stops asking once it has enough.
    expect(capped.ranges.map(([from]) => from)).toEqual([0, 1000]);
  });

  describe("who gets the credit", () => {
    it("credits the rep Calendly recorded, ahead of every other signal", async () => {
      const { client } = fakeClient({
        bookings: [
          booking({
            scheduled_by: "https://api.calendly.com/users/rep-1",
            utm_source: "youtube",
            lead: { booked_by_setter: "Someone Else" },
          }),
        ],
      });

      const [row] = (
        await buildCallCreditReport({ window: WINDOW }, { client })
      ).rows;

      expect(row.credit).toMatchObject({ kind: "rep", basis: "calendly" });
    });

    it("prefers Close's mirrored setter over the site lead row, matching email case-insensitively", async () => {
      const { client } = fakeClient({
        bookings: [
          booking({
            invitee_email: "  Jane@Example.com ",
            lead: { booked_by_setter: "Lead Row Setter" },
          }),
        ],
        closeFunnel: [
          { email: "JANE@example.com", setter_name: " Mirror Setter " },
        ],
      });

      const [row] = (
        await buildCallCreditReport({ window: WINDOW }, { client })
      ).rows;

      expect(row.closeSetter).toBe("Mirror Setter");
      expect(row.credit).toMatchObject({
        kind: "rep",
        basis: "close",
        who: "Mirror Setter",
      });
    });

    it("falls back to the lead row's setter when Close has none for that email", async () => {
      const { client } = fakeClient({
        bookings: [booking({ lead: { booked_by_setter: "Lead Row Setter" } })],
        closeFunnel: [{ email: "someone-else@example.com", setter_name: "X" }],
      });

      const [row] = (
        await buildCallCreditReport({ window: WINDOW }, { client })
      ).rows;

      expect(row.closeSetter).toBe("Lead Row Setter");
    });

    it("keeps the first Close setter when one email appears twice", async () => {
      const { client } = fakeClient({
        bookings: [booking()],
        closeFunnel: [
          { email: "jane@example.com", setter_name: "First" },
          { email: "jane@example.com", setter_name: "Second" },
        ],
      });

      const [row] = (
        await buildCallCreditReport({ window: WINDOW }, { client })
      ).rows;

      expect(row.closeSetter).toBe("First");
    });

    it("infers the last setter touch with the gap in minutes, and only when it came before the booking", async () => {
      const touched = booking({
        id: "touched",
        booked_at: "2026-09-18T12:30:00.000Z",
        lead: {
          booked_by_setter: null,
          setter_touch_name: "Connor",
          setter_touch_at: "2026-09-18T12:00:00.000Z",
        },
      });
      const touchAfter = booking({
        id: "touch-after",
        booked_at: "2026-09-17T12:00:00.000Z",
        lead: {
          booked_by_setter: null,
          setter_touch_name: "Connor",
          setter_touch_at: "2026-09-17T13:00:00.000Z",
        },
      });
      const { client } = fakeClient({ bookings: [touched, touchAfter] });

      const rows = (await buildCallCreditReport({ window: WINDOW }, { client }))
        .rows;
      const byId = new Map(rows.map((row) => [row.id, row]));

      expect(byId.get("touched")?.credit.evidence).toContain("30");
      expect(byId.get("touched")?.credit.who).toBe("Connor");
      // A touch after the booking cannot have caused it.
      expect(byId.get("touch-after")?.credit.who).not.toBe("Connor");
    });
  });

  it("does not leak a Close failure into the report: a throwing chat index is an empty index", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ bookings: [booking()] });
    const originalFrom = client.from.bind(client);
    (client as unknown as { from: (t: string) => unknown }).from = (
      table: string,
    ) => {
      if (table === "chatbot_conversations") throw new Error("chat table down");
      return originalFrom(table as never);
    };

    const report = await buildCallCreditReport({ window: WINDOW }, { client });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].chat).toBeNull();
  });
});
