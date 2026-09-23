import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the test must pass its own client");
  },
}));

const { getBookedPace } = await import("./booked-metrics-data");

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
