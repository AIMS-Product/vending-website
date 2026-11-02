import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  domRulesChecks,
  rosterIn,
  type DomV2Read,
} from "./data-audit-dom-rules";

const rulesJson = readFileSync(
  path.join(__dirname, "../booked-calls-v2/rules.v2.7.json"),
  "utf8",
);
const aggregatesPy = `BOOKING_SCOPE = "vp-closers.v1"
VP_BOOKING_CLOSERS = (
    "Christian Hartwell", "Scott Seymour", "Robin Perkins", "Eric Piccione",
    "Joe Vaughan", "Shreya Bechra", "Luke Herman", "Ariella Irvine", "Joe Dysert",
)
CLOSERS = ("Oscar Pugh",)`;

const NOW = new Date("2026-11-02T22:00:00Z");
const archive = {
  rules_version: "v",
  booking_scope: "vp-closers.v1",
  generated_at: "2026-11-02T21:45:00Z",
  totals: { bookings: 20 },
};
const dom = (over: Partial<DomV2Read> = {}): DomV2Read => ({
  rulesJson,
  aggregatesPy,
  archive,
  ...over,
});
const booked = (counted: number) =>
  (async () => ({ ok: true, summary: { counted } })) as never;

const statuses = async (read: DomV2Read, ours = 20) =>
  Object.fromEntries(
    (await domRulesChecks(NOW, async () => read, booked(ours))).map((r) => [
      r.checkId,
      r.status,
    ]),
  );

describe("domRulesChecks", () => {
  it("passes when his files and count match ours", async () => {
    expect(await statuses(dom(), 19)).toEqual({
      "company-mtd-v2-rules": "pass",
      "company-mtd-v2-scope": "pass",
      "company-mtd-v2-booked": "pass",
    });
  });

  it("fails on any change to his rules file", async () => {
    const result = await statuses(dom({ rulesJson: `${rulesJson} ` }));
    expect(result["company-mtd-v2-rules"]).toBe("fail");
  });

  it("fails on a changed roster, an unreadable one, or a new scope", async () => {
    const swapped = aggregatesPy.replace("Joe Dysert", "Oscar Pugh");
    for (const read of [
      dom({ aggregatesPy: swapped }),
      dom({ aggregatesPy: "moved elsewhere" }),
      dom({ archive: { ...archive, booking_scope: "vp-closers.v2" } }),
    ]) {
      expect((await statuses(read))["company-mtd-v2-scope"]).toBe("fail");
    }
  });

  it("flags a count past one call, and skips a stale or missing build", async () => {
    expect((await statuses(dom(), 15))["company-mtd-v2-booked"]).toBe("fail");
    const stale = { ...archive, generated_at: "2026-11-02T10:00:00Z" };
    expect(
      (await statuses(dom({ archive: stale })))["company-mtd-v2-booked"],
    ).toBe("skipped");
    expect(
      (await statuses(dom({ archive: null })))["company-mtd-v2-booked"],
    ).toBe("skipped");
  });
});

describe("rosterIn", () => {
  it("reads only the VP tuple, not the other closer list", () => {
    expect(rosterIn(aggregatesPy)).toHaveLength(9);
    expect(rosterIn(aggregatesPy)).not.toContain("oscar pugh");
  });
});
