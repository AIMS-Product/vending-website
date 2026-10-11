import { describe, expect, it } from "vitest";
import { ceoActions, verdictOf } from "./google-ads-ceo";
import type { GoogleAdsRow } from "./google-ads-dashboard";
import type { BeforeAfter, CampaignHealth } from "./google-ads-insights";

const row = (key: string, spend: number, booked: number): GoogleAdsRow => ({
  key,
  label: `C${key}`,
  spend,
  clicks: 0,
  impressions: 0,
  leads: booked,
  booked,
  won: 0,
  wonValue: 0,
  costPerBooked: booked ? spend / booked : null,
});

const health = (
  id: string,
  over: Partial<CampaignHealth> = {},
): CampaignHealth => ({
  campaignId: id,
  name: `C${id}`,
  status: "ENABLED",
  dailyBudget: 150,
  liveAds: 4,
  approvedAds: 4,
  underReview: 0,
  disapproved: 0,
  flags: [],
  ...over,
});

const period = (cpb: number | null) => ({
  from: "2026-09-10",
  to: "2026-10-09",
  days: 30,
  spend: 0,
  booked: 0,
  costPerBooked: cpb,
  spendPerWeek: 0,
  bookedPerWeek: 0,
});

const ba = (
  before: number,
  after: number | null,
  settled: boolean,
): BeforeAfter => ({
  before: period(before),
  after: after === null ? null : period(after),
  readoutAfter: "2026-10-24",
  settled,
});

describe("verdictOf", () => {
  it("is too early until the learning period is over", () => {
    expect(verdictOf(ba(149, 98, false))).toBe("too-early");
    expect(verdictOf(ba(149, null, true))).toBe("too-early");
  });
  it("calls better, worse or flat against the baseline with a 10% band", () => {
    expect(verdictOf(ba(149, 120, true))).toBe("better");
    expect(verdictOf(ba(149, 170, true))).toBe("worse");
    expect(verdictOf(ba(149, 150, true))).toBe("flat");
  });
});

describe("ceoActions", () => {
  const w2 = row("1", 5900, 40); // $148
  const conquest = row("2", 1497, 5); // $299
  const dud = row("3", 400, 0);
  const tiny = row("4", 182, 0);
  const totals = row("t", 7979, 45); // ~$177

  it("flags expensive and zero-booking campaigns but ignores small spend", () => {
    const out = ceoActions([w2, conquest, dud, tiny], totals, []);
    // Conquest at 1.7x is under the 2x bar; Mike VSL-sized spend is too small to judge.
    expect(out.map((a) => a.title)).toEqual([
      "C3: $400 spent, no booked calls",
    ]);
  });

  it("flags a campaign at 2x the average", () => {
    const pricey = row("5", 1200, 3); // $400 vs avg $177
    const out = ceoActions([w2, pricey], totals, []);
    expect(out[0].title).toBe("C5: $400 per booked call, 2.3x the average");
  });

  it("skips paused campaigns and puts serving problems first", () => {
    const out = ceoActions([dud], totals, [
      health("3", { status: "PAUSED" }),
      health("9", { approvedAds: 0, disapproved: 4 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("C9 is not showing ads");
  });

  it("suggests budget only for a cheap campaign limited by budget, max three", () => {
    const out = ceoActions([w2], totals, [
      health("1", { flags: ["Limited by budget"] }),
    ]);
    expect(out[0]).toMatchObject({
      tone: "good",
      title: "C1 could take more budget",
    });
    const many = ceoActions(
      [row("a", 500, 0), row("b", 500, 0), row("c", 500, 0), row("d", 500, 0)],
      totals,
      [],
    );
    expect(many).toHaveLength(3);
  });
});
