import { describe, expect, it } from "vitest";
import { rankChannelMoves, rateWithSample } from "./overview-highlights";
import {
  METRIC_KEYS,
  type ChannelReportRow,
  type Metrics,
} from "./channel-report-rollup";

function metrics(overrides: Partial<Metrics> = {}): Metrics {
  const out = {} as Metrics;
  for (const key of METRIC_KEYS) out[key] = null;
  return { ...out, ...overrides };
}

function row(
  label: string,
  leads: number | null,
  prior: number | null,
): ChannelReportRow {
  return {
    key: label,
    label,
    metrics: metrics({ leads }),
    prior: metrics({ leads: prior }),
    rates: { leadPct: null, bookPct: null, winPct: null },
    directBooked: null,
    costPerLead: null,
    costPerBooked: null,
  };
}

describe("rankChannelMoves", () => {
  it("ranks by leads gained, not by percentage", () => {
    const moves = rankChannelMoves([
      row("YouTube", 150, 120),
      row("Instagram", 12, 6),
    ]);
    expect(moves.gaining.map((move) => move.label)).toEqual([
      "YouTube",
      "Instagram",
    ]);
    expect(moves.gaining[0].change).toBe(30);
    expect(moves.gaining[1].changePct).toBe(100);
  });

  it("splits gaining from slipping and drops flat channels", () => {
    const moves = rankChannelMoves([
      row("Google Ads", 40, 90),
      row("Website", 30, 30),
      row("LinkedIn", 20, 10),
    ]);
    expect(moves.gaining.map((move) => move.label)).toEqual(["LinkedIn"]);
    expect(moves.slipping.map((move) => move.label)).toEqual(["Google Ads"]);
    expect(moves.slipping[0].changePct).toBe(-56);
  });

  it("refuses a verdict on a sample too small to mean anything", () => {
    const moves = rankChannelMoves([row("Trustpilot", 4, 2)]);
    expect(moves.gaining).toEqual([]);
    expect(moves.unrated).toBe(1);
  });

  it("counts a channel with no prior observation as unrated", () => {
    const moves = rankChannelMoves([row("Braze", 40, null)]);
    expect(moves.gaining).toEqual([]);
    expect(moves.unrated).toBe(1);
  });

  it("ignores channels no lead connector covers at all", () => {
    const moves = rankChannelMoves([row("Organic search", null, null)]);
    expect(moves.unrated).toBe(0);
  });

  it("reports a channel that started from nothing without inventing a share", () => {
    const moves = rankChannelMoves([row("Meta Ads", 18, 0)]);
    expect(moves.gaining[0].change).toBe(18);
    expect(moves.gaining[0].changePct).toBeNull();
  });

  it("keeps only the biggest movers", () => {
    const moves = rankChannelMoves(
      [row("A", 100, 10), row("B", 60, 10), row("C", 40, 10), row("D", 20, 10)],
      2,
    );
    expect(moves.gaining.map((move) => move.label)).toEqual(["A", "B"]);
  });
});

describe("rateWithSample", () => {
  it("prints a rate once enough leads sit behind it", () => {
    expect(rateWithSample(9.4, 120)).toBe(9.4);
  });

  it("suppresses a rate on a tiny sample", () => {
    expect(rateWithSample(100, 2)).toBeNull();
  });

  it("suppresses a rate above 100%, which means the two sides disagree", () => {
    expect(rateWithSample(140, 500)).toBeNull();
  });

  it("passes null through", () => {
    expect(rateWithSample(null, 500)).toBeNull();
    expect(rateWithSample(9.4, null)).toBeNull();
  });
});
