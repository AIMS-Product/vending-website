import { describe, expect, it } from "vitest";
import { readAllPages } from "@/lib/services/paged-read";

/** A table of `total` numbered rows, answering range requests like PostgREST. */
function table(total: number) {
  const calls: Array<{ from: number; to: number; count?: string }> = [];
  const query = (from: number, to: number, count: "exact" | undefined) => {
    calls.push({ from, to, count });
    return Promise.resolve({
      data: Array.from({
        length: Math.max(0, Math.min(to + 1, total) - from),
      }).map((_, index) => ({ id: from + index })),
      count: count === "exact" ? total : null,
      error: null,
    });
  };
  return { calls, query };
}

describe("readAllPages", () => {
  it("reads every row of a multi-page table", async () => {
    const { calls, query } = table(8_365);
    const { rows, error } = await readAllPages(query, { pageSize: 1_000 });
    expect(error).toBeNull();
    expect(rows).toHaveLength(8_365);
    expect(rows.map((row) => row.id)).toEqual(
      Array.from({ length: 8_365 }, (_, index) => index),
    );
    // One probe plus the eight remaining ranges — the count is asked once.
    expect(calls).toHaveLength(9);
    expect(calls.filter((call) => call.count === "exact")).toHaveLength(1);
  });

  it("issues the pages after the probe concurrently", async () => {
    let live = 0;
    let peak = 0;
    const { rows } = await readAllPages<{ id: number }>(
      async (from, to, count) => {
        live += 1;
        peak = Math.max(peak, live);
        await new Promise((resolve) => setTimeout(resolve, 1));
        live -= 1;
        return {
          data: Array.from({
            length: Math.max(0, Math.min(to + 1, 5_000) - from),
          }).map((_, index) => ({ id: from + index })),
          count: count === "exact" ? 5_000 : null,
          error: null,
        };
      },
      { pageSize: 1_000 },
    );
    expect(rows).toHaveLength(5_000);
    expect(peak).toBeGreaterThan(1);
  });

  it("stops at one request when the table fits in a page", async () => {
    const { calls, query } = table(12);
    const { rows } = await readAllPages(query, { pageSize: 1_000 });
    expect(rows).toHaveLength(12);
    expect(calls).toHaveLength(1);
  });

  it("returns the error and no rows when the probe fails", async () => {
    const { rows, error } = await readAllPages(
      () => Promise.resolve({ data: null, error: { message: "boom" } }),
      { pageSize: 10 },
    );
    expect(rows).toEqual([]);
    expect(error).toEqual({ message: "boom" });
  });

  it("keeps the rows it read when a later page fails", async () => {
    const { rows, error } = await readAllPages<{ id: number }>(
      (from, _to, count) =>
        Promise.resolve(
          from === 0
            ? {
                data: Array.from({ length: 10 }, (_, i) => ({ id: i })),
                count: count === "exact" ? 30 : null,
                error: null,
              }
            : { data: null, error: { message: "page failed" } },
        ),
      { pageSize: 10 },
    );
    expect(rows).toHaveLength(10);
    expect(error).toEqual({ message: "page failed" });
  });

  it("finishes without a count by stopping at the first short page", async () => {
    const { rows, error } = await readAllPages<{ id: number }>(
      (from, to) =>
        Promise.resolve({
          data: Array.from({
            length: Math.max(0, Math.min(to + 1, 2_500) - from),
          }).map((_, index) => ({ id: from + index })),
          count: null,
          error: null,
        }),
      { pageSize: 1_000, maxRows: 10_000 },
    );
    expect(error).toBeNull();
    expect(rows).toHaveLength(2_500);
  });

  it("never reads past maxRows", async () => {
    const { calls, query } = table(1_000_000);
    await readAllPages(query, { pageSize: 1_000, maxRows: 3_000 });
    expect(calls).toHaveLength(3);
  });
});
