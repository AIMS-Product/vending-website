import { describe, expect, it } from "vitest";
import { briefingOf } from "./ceo-briefing";

const base = {
  period: "Last 30 days",
  priorPhrase: "the 30 days before",
  leads: { now: 467, before: 452 },
  booked: { now: 631, before: 584 },
  revenue: { now: 442870, before: 503000, deals: 59 },
  showRate: { now: 54.8, before: 56.9 },
};

describe("briefingOf", () => {
  it("leads with booked calls and revenue in one sentence", () => {
    expect(briefingOf(base).headline).toBe(
      "Last 30 days: 631 booked sales calls (up 8% on the 30 days before) and $442,870 won from 59 deals.",
    );
  });

  it("lists problems before wins and ignores small moves", () => {
    const { items } = briefingOf({
      ...base,
      leads: { now: 600, before: 452 },
    });
    expect(items.map((i) => i.tone)).toEqual(["bad", "bad", "good"]);
    expect(items[0]!.text).toMatch(/^Revenue won down 12%/);
    expect(items[1]!.text).toMatch(/^Show rate down 2.1 points/);
    expect(items[2]!.text).toMatch(/^Leads up 33%/);
  });

  it("says so when nothing could be read", () => {
    const out = briefingOf({
      ...base,
      leads: null,
      booked: null,
      revenue: null,
      showRate: null,
    });
    expect(out.headline).toBe("Last 30 days: no numbers could be read.");
    expect(out.items).toEqual([]);
  });
});
