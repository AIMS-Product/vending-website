import { describe, expect, it, vi } from "vitest";
import { observedSpend } from "./cac-report-data";

type SpendRow = { channel: string; source: string; spend: number | null };

/** channel_daily stand-in that honours `.range()` and caps pages at 1,000 rows. */
function spendClient(rows: SpendRow[], failure: { message: string } | null) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "gte", "lte", "not", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.range = vi.fn((from: number, to: number) =>
    Promise.resolve({
      data: failure ? null : rows.slice(from, Math.min(to + 1, from + 1000)),
      count: rows.length,
      error: failure,
    }),
  );
  return { from: () => builder } as unknown as Parameters<
    typeof observedSpend
  >[0];
}

describe("observedSpend", () => {
  it("sums spend across more than one 1,000-row page", async () => {
    const rows: SpendRow[] = [
      ...Array.from({ length: 1200 }, () => ({
        channel: "paid",
        source: "meta",
        spend: 2,
      })),
      ...Array.from({ length: 300 }, () => ({
        channel: "paid",
        source: "google",
        spend: 1,
      })),
    ];

    const totals = await observedSpend(spendClient(rows, null), "2026-09-01");

    expect(totals.get("paid|meta")).toBe(2400);
    expect(totals.get("paid|google")).toBe(300);
  });

  it("logs and returns no spend when the read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const totals = await observedSpend(
      spendClient([], { message: "boom" }),
      "2026-09-01",
    );

    expect(totals.size).toBe(0);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
