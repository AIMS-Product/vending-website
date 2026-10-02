import { describe, expect, it, vi } from "vitest";
import { fetchGoingOut, fetchRuns, type ReportClient } from "./channel-report";
import { logReadFailure } from "./read-failure";

type Failure = { code?: string; message: string };

/** Chainable stand-in; `.range()` honours the 1,000-row API cap. */
function builderFor(
  rows: unknown[],
  failure: Failure | null,
): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "in", "gte", "lte"]) {
    builder[method] = () => builder;
  }
  builder.limit = () =>
    Promise.resolve({ data: failure ? null : rows, error: failure });
  builder.range = (from: number, to: number) =>
    Promise.resolve({
      data: failure ? null : rows.slice(from, Math.min(to + 1, from + 1000)),
      count: rows.length,
      error: failure,
    });
  return builder;
}

describe("logReadFailure", () => {
  it("logs the loader name with the database code and message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    logReadFailure("example", { code: "57P01", message: "dropped" });
    logReadFailure("thrown", new Error("boom"));

    expect(log).toHaveBeenNthCalledWith(1, "example read failed", {
      code: "57P01",
      message: "dropped",
    });
    expect(log).toHaveBeenNthCalledWith(2, "thrown read failed", {
      code: undefined,
      message: "boom",
    });
    log.mockRestore();
  });
});

describe("fetchRuns", () => {
  it("returns no runs and logs when the read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      from: () => builderFor([], { code: "42P01", message: "no table" }),
    } as unknown as ReportClient;

    await expect(fetchRuns(client)).resolves.toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "channel sync runs read failed",
      expect.objectContaining({ code: "42P01" }),
    );
    log.mockRestore();
  });
});

describe("fetchGoingOut", () => {
  const link = {
    id: "l1",
    url: "https://www.vendingpreneurs.com/book",
    label: "Book",
    utm_source: "youtube",
    utm_medium: "video",
    utm_campaign: "c",
    utm_content: "d",
    utm_term: null,
    bitly_id: "bit1",
    bitly_url: "https://bit.ly/x",
    created_at: "2026-09-01T00:00:00.000Z",
  };

  it("counts every day of clicks, past the 1,000-row API cap", async () => {
    const clicks = Array.from({ length: 1500 }, () => ({
      bitly_id: "bit1",
      day: "2026-09-20",
      clicks: 1,
    }));
    const client = {
      from: (table: string) =>
        builderFor(table === "marketing_links" ? [link] : clicks, null),
    } as unknown as ReportClient;

    const rows = await fetchGoingOut(
      client,
      "2026-08-01",
      "2026-09-30",
      "2026-09-01",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.clicks).toBe(1500);
  });

  it("returns no rows and logs when the links read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      from: () => builderFor([], { message: "boom" }),
    } as unknown as ReportClient;

    await expect(
      fetchGoingOut(client, "2026-08-01", "2026-09-30", "2026-09-01"),
    ).resolves.toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "going out links read failed",
      expect.anything(),
    );
    log.mockRestore();
  });
});
