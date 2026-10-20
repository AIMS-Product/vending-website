import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the test must pass its own client");
  },
}));

const { getBookedPace, fetchBookings, fetchFunnels } =
  await import("./booked-metrics-data");

/** Records every `order` call per table; every read comes back empty. */
function recordingClient() {
  const orders: Record<string, unknown[][]> = {};
  const from = (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "gte", "not", "eq", "range"]) {
      query[method] = () => query;
    }
    query.order = (...args: unknown[]) => {
      (orders[table] ??= []).push(args);
      return query;
    };
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
    return query;
  };
  return { client: { from } as never, orders };
}

describe("getBookedPace reads", () => {
  /**
   * The bookings read pages concurrently. created_at alone ties across a page
   * boundary, so without a unique tiebreak a row can land on two pages or none.
   */
  it("orders the bookings read by created_at, then id", async () => {
    const { client, orders } = recordingClient();

    await getBookedPace({ client, now: new Date("2026-09-22T18:00:00Z") });

    expect(orders.calendly_bookings?.map((args) => args[0])).toEqual([
      "created_at",
      "id",
    ]);
  });
});

type Client = Parameters<typeof fetchBookings>[0];

function clientWithFailedSecondPage(): Client {
  const query = {
    select: () => query,
    gte: () => query,
    order: () => query,
    range: async (from: number) =>
      from === 0
        ? {
            data: Array.from({ length: 1000 }, () => ({})),
            count: 1001,
            error: null,
          }
        : {
            data: null,
            count: null,
            error: { code: "TEST", message: "Page unavailable" },
          },
  };
  return { from: () => query } as unknown as Client;
}

afterEach(() => vi.restoreAllMocks());

describe("booking source completeness", () => {
  it("rejects partial booking rows when a later page fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await fetchBookings(clientWithFailedSecondPage(), "2026-10-20"),
    ).toBeNull();
  });

  it("rejects partial funnel attribution when a later page fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await fetchFunnels(clientWithFailedSecondPage())).toBeNull();
  });

  it("keeps a successful empty source distinct from a failed read", async () => {
    const query = {
      select: () => query,
      gte: () => query,
      order: () => query,
      range: async () => ({ data: [], count: 0, error: null }),
    };
    const client = { from: () => query } as unknown as Client;
    expect(await fetchBookings(client, "2026-10-20")).toEqual([]);
    expect(await fetchFunnels(client)).toEqual([]);
  });
});
