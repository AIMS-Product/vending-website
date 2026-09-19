import { describe, expect, it } from "vitest";
import {
  assertion,
  compare,
  errorResult,
  summariseAudit,
  type AuditResult,
} from "./data-audit";

const base = {
  checkId: "ga4-visits",
  label: "Visits",
  window: "yesterday",
  sourceName: "Google Analytics",
  tolerancePct: 2,
};

describe("compare", () => {
  it("passes inside the tolerance and names both numbers", () => {
    const result = compare({ ...base, ours: 1020, source: 1000 });
    expect(result.status).toBe("pass");
    expect(result.diffPct).toBe(2);
    expect(result.detail).toContain("1,020");
    expect(result.detail).toContain("1,000");
  });

  it("warns past the tolerance and fails at twice it", () => {
    expect(compare({ ...base, ours: 1030, source: 1000 }).status).toBe("warn");
    expect(compare({ ...base, ours: 1050, source: 1000 }).status).toBe("fail");
    expect(compare({ ...base, ours: 900, source: 1000 })).toMatchObject({
      status: "fail",
      detail: expect.stringContaining("10% below"),
    });
  });

  it("never passes a check whose source said nothing", () => {
    const result = compare({ ...base, ours: 500, source: null });
    expect(result.status).toBe("skipped");
    expect(result.detail).toContain("the source reported no number");
  });

  it("treats two observed zeros as agreement, not as a missing number", () => {
    expect(compare({ ...base, ours: 0, source: 0 }).status).toBe("pass");
  });

  it("fails when the source reports nothing but we stored something", () => {
    // A connector that invents rows looks exactly like this.
    expect(compare({ ...base, ours: 40, source: 0 }).status).toBe("fail");
  });

  it("formats money so a spend line reads as dollars", () => {
    const result = compare({
      ...base,
      checkId: "meta-spend",
      ours: 45322.36,
      source: 45322.36,
      unit: "money",
    });
    expect(result.detail).toContain("$45,322.36");
  });
});

describe("summariseAudit", () => {
  const result = (
    status: AuditResult["status"],
    checkId: string,
  ): AuditResult =>
    compare({
      ...base,
      checkId,
      ours: status === "pass" ? 100 : 200,
      source: 100,
    });

  it("says so plainly when everything agrees", () => {
    const summary = summariseAudit([result("pass", "a"), result("pass", "b")]);
    expect(summary.status).toBe("pass");
    expect(summary.headline).toBe(
      "All 2 checks agree with their source systems.",
    );
  });

  it("leads with the failures and orders problems worst first", () => {
    const summary = summariseAudit([
      result("pass", "a"),
      assertion({
        ...base,
        checkId: "holes",
        ok: false,
        warnOnly: true,
        detail: "One day has no rows.",
      }),
      errorResult(
        "calendly",
        "Bookings",
        "yesterday",
        "Calendly",
        new Error("401"),
      ),
      result("fail", "b"),
    ]);

    expect(summary.status).toBe("fail");
    expect(summary.problems.map((problem) => problem.checkId)).toEqual([
      "b",
      "calendly",
      "holes",
    ]);
    expect(summary.headline).toContain("1 number does not match its source");
    expect(summary.headline).toContain("1 of 4 agree");
  });
});
