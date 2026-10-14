import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareWhenFresh,
  fetchCompanyMtdBuiltAt,
  type CompanyMtdRead,
} from "./close-mtd-funnel-data";

const company: CompanyMtdRead = {
  ok: true,
  totals: { booked: 225, showed: 126, qualified: 90, won: 15, revenue: 121814 },
};
const synced = "2026-10-13T12:05:00Z";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("compareWhenFresh", () => {
  it("compares an MTD build within two hours of our mirror", () => {
    expect(compareWhenFresh(company, "2026-10-13T10:30:00Z", synced)).toBe(
      company,
    );
  });

  it("does not compare an MTD build over two hours behind, and says when it rebuilt", () => {
    expect(compareWhenFresh(company, "2026-10-13T09:26:30Z", synced)).toEqual({
      ok: false,
      error: "MTD dashboard last rebuilt Oct 13, 2:26 AM PT",
    });
  });

  it("still compares a build exactly two hours behind", () => {
    expect(compareWhenFresh(company, "2026-10-13T10:05:00Z", synced)).toBe(
      company,
    );
  });

  it("keeps today's comparison when the build time is unknown or unreadable", () => {
    expect(compareWhenFresh(company, null, synced)).toBe(company);
    expect(compareWhenFresh(company, "not a date", synced)).toBe(company);
  });

  it("passes an unreachable dashboard through unchanged", () => {
    const down: CompanyMtdRead = {
      ok: false,
      error: "MTD dashboard answered 404.",
    };
    expect(compareWhenFresh(down, "2026-10-13T01:00:00Z", synced)).toBe(down);
  });
});

describe("fetchCompanyMtdBuiltAt", () => {
  it("reads the last commit to the month's data file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json([
          { commit: { committer: { date: "2026-10-14T01:40:56Z" } } },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchCompanyMtdBuiltAt("2026-10")).toBe(
      "2026-10-14T01:40:56Z",
    );
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "path=archives/data-2026-10.json",
    );
  });

  it("returns null, never throws, when GitHub is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await fetchCompanyMtdBuiltAt("2026-10")).toBeNull();
  });

  it("returns null when GitHub refuses (rate limit)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 403 })),
    );
    expect(await fetchCompanyMtdBuiltAt("2026-10")).toBeNull();
  });

  it("returns null when GitHub lists no commit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    expect(await fetchCompanyMtdBuiltAt("2026-10")).toBeNull();
  });
});
