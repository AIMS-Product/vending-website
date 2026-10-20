import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { fetchBookings, fetchFunnels } from "./booked-metrics-data";

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
