import { describe, expect, it } from "vitest";
import { companyMtdChecks } from "./data-audit-company-mtd";
import type { CloseMtdReport } from "./close-mtd-funnel-data";
import type { CompanyMtdTotals } from "./close-mtd-funnel";

const october: CompanyMtdTotals = {
  booked: 212,
  showed: 126,
  qualified: 91,
  won: 15,
  revenue: 121814,
};

const report = (
  ours: CompanyMtdTotals,
  company: Extract<CloseMtdReport, { ok: true }>["company"],
): CloseMtdReport =>
  ({
    ok: true,
    mirrorSyncedAt: null,
    company,
    funnel: { from: "2026-10-01", to: "2026-10-12", companyView: ours },
  }) as unknown as CloseMtdReport;

const now = new Date("2026-10-13T12:30:00Z");

describe("companyMtdChecks", () => {
  it("passes every number when ours equals the MTD dashboard", async () => {
    const results = await companyMtdChecks(now, async () =>
      report(october, { ok: true, totals: october }),
    );
    expect(results.map((r) => [r.checkId, r.status])).toEqual([
      ["company-mtd-booked", "pass"],
      ["company-mtd-showed", "pass"],
      ["company-mtd-qualified", "pass"],
      ["company-mtd-won", "pass"],
      ["company-mtd-revenue", "pass"],
    ]);
  });

  it("fails the number that drifted, not the others", async () => {
    const results = await companyMtdChecks(now, async () =>
      report({ ...october, booked: 200 }, { ok: true, totals: october }),
    );
    expect(
      results.find((r) => r.checkId === "company-mtd-booked")?.status,
    ).toBe("fail");
    expect(results.filter((r) => r.status === "pass")).toHaveLength(4);
  });

  it("passes one call of timing on a small count, fails three", async () => {
    const status = async (won: number) =>
      (
        await companyMtdChecks(now, async () =>
          report({ ...october, won }, { ok: true, totals: october }),
        )
      ).find((r) => r.checkId === "company-mtd-won")?.status;
    expect(await status(16)).toBe("pass");
    expect(await status(18)).toBe("fail");
  });

  it("never reads an unreachable dashboard as agreement", async () => {
    const results = await companyMtdChecks(now, async () =>
      report(october, { ok: false, error: "MTD dashboard answered 404." }),
    );
    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect(results[0]!.detail).toContain("404");
  });

  it("throws when our own panel cannot load, so the run records an error", async () => {
    await expect(
      companyMtdChecks(now, async () => ({ ok: false, error: "mirror down" })),
    ).rejects.toThrow("mirror down");
  });
});
