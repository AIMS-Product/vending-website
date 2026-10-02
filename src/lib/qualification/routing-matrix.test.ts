import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INVEST_OPTIONS,
  THANK_YOU_STATES,
  TIMELINE_OPTIONS,
  scoreQualification,
  type InvestVariant,
  type QualificationBand,
  type ThankYouStateKey,
} from "./scoring";
import { THANK_YOU_LINKS, THANK_YOU_STATE_LINKS } from "./thank-you-links";

/**
 * Where a lead lands, end to end: every answer combination the form can
 * produce, through `scoreQualification`, to the band, the thank-you state and
 * the link it opens. scoring.test.ts pins individual boundaries; this holds
 * the whole table so a threshold, points or link edit shows up as a diff here
 * and not as a customer on the wrong calendar.
 */

const BAND_ORDER: QualificationBand[] = [
  "disqualify",
  "setting",
  "lane_1",
  "top_closers",
];

type Cell = {
  variant: InvestVariant;
  invest: string;
  timeline: string | "operator";
  total: number;
  timelinePoints: number;
  investPoints: number;
  band: QualificationBand;
  disqualified: boolean;
  state: ThankYouStateKey;
};

function everyAnswer(): Cell[] {
  const cells: Cell[] = [];
  for (const variant of ["A", "B"] as const) {
    for (const invest of INVEST_OPTIONS[variant]) {
      const timelines = [
        ...TIMELINE_OPTIONS.map((option) => option.value),
        "operator",
      ];
      for (const timeline of timelines) {
        const result = scoreQualification(
          timeline === "operator"
            ? { invest: invest.value, variant, operator: true }
            : { timeline, invest: invest.value, variant },
        );
        cells.push({
          variant,
          invest: invest.value,
          timeline,
          total: result.total,
          timelinePoints: result.timelinePoints,
          investPoints: result.investPoints,
          band: result.band,
          disqualified: result.disqualified,
          state: result.thankYouState,
        });
      }
    }
  }
  return cells;
}

describe("the full answer table", () => {
  const cells = everyAnswer();

  it("covers every combination the form can produce", () => {
    // A: 6 invest rungs, B: 5; each with 5 timelines + the operator gate.
    expect(cells).toHaveLength((6 + 5) * 6);
  });

  it("never scores above 100 or below 0, and the total is always urgency plus investment", () => {
    for (const cell of cells) {
      expect(cell.total).toBeGreaterThanOrEqual(0);
      expect(cell.total).toBeLessThanOrEqual(100);
      expect(cell.total, JSON.stringify(cell)).toBe(
        cell.timelinePoints + cell.investPoints,
      );
    }
  });

  it("routes by band, and a disqualifying invest answer always lands on not_right_time", () => {
    for (const cell of cells) {
      const expected: Record<QualificationBand, ThankYouStateKey> = {
        disqualify: "not_right_time",
        setting: "good_potential",
        lane_1: "strong_fit",
        top_closers: "perfect_fit",
      };
      expect(cell.state, JSON.stringify(cell)).toBe(expected[cell.band]);
      if (cell.disqualified) {
        expect(cell.band).toBe("disqualify");
        expect(cell.state).toBe("not_right_time");
      }
    }
  });

  it("is monotonic: among qualifying answers, a higher total never lands in a lower band", () => {
    const qualifying = cells
      .filter((cell) => !cell.disqualified)
      .sort((a, b) => a.total - b.total);

    for (let index = 1; index < qualifying.length; index += 1) {
      expect(
        BAND_ORDER.indexOf(qualifying[index].band),
        `${qualifying[index - 1].total} -> ${qualifying[index].total}`,
      ).toBeGreaterThanOrEqual(BAND_ORDER.indexOf(qualifying[index - 1].band));
    }
  });

  it("is monotonic in each answer: a longer timeline or smaller cheque never improves the band", () => {
    for (const variant of ["A", "B"] as const) {
      const invest = INVEST_OPTIONS[variant].filter(
        (option) => !option.disqualifies,
      );
      const timelines = [...TIMELINE_OPTIONS].sort(
        (a, b) => b.points - a.points,
      );
      for (const option of invest) {
        let previous = -1;
        for (const timeline of timelines) {
          const result = scoreQualification({
            timeline: timeline.value,
            invest: option.value,
            variant,
          });
          const rank = BAND_ORDER.indexOf(result.band);
          // Walking from most to least urgent, the band can only fall.
          if (previous !== -1) expect(rank).toBeLessThanOrEqual(previous);
          previous = rank;
        }
      }
    }
  });

  it("an existing operator is never scored below the same lead's most urgent timeline", () => {
    for (const variant of ["A", "B"] as const) {
      for (const option of INVEST_OPTIONS[variant]) {
        const operator = scoreQualification({
          invest: option.value,
          variant,
          operator: true,
        });
        const asap = scoreQualification({
          timeline: "asap",
          invest: option.value,
          variant,
        });
        expect(operator.total).toBe(asap.total);
        expect(operator.band).toBe(asap.band);
      }
    }
  });

  it("bands every reachable total by the documented thresholds (30 / 45 / 75, Kody 2026-07-28)", () => {
    const expectedBand = (total: number): QualificationBand =>
      total <= 30
        ? "disqualify"
        : total <= 45
          ? "setting"
          : total <= 75
            ? "lane_1"
            : "top_closers";

    const reachable = new Set<number>();
    for (const cell of cells) {
      if (cell.disqualified) continue;
      reachable.add(cell.total);
      expect(cell.band, JSON.stringify(cell)).toBe(expectedBand(cell.total));
    }
    // Both sides of every threshold are actually reachable, so a shifted
    // boundary cannot hide between two totals nobody can score.
    for (const total of [30, 35, 45, 50, 75, 80]) {
      expect(reachable.has(total), `total ${total}`).toBe(true);
    }
  });

  it("holds the table of who reaches each band, as a snapshot of today's policy", () => {
    const reach = (band: QualificationBand) =>
      cells
        .filter((cell) => cell.band === band)
        .map(
          (cell) =>
            `${cell.variant}:${cell.invest}:${cell.timeline}=${cell.total}`,
        );

    // The variant A top rung ($15k+) with any timeline still earns a call.
    expect(reach("top_closers")).toEqual(
      expect.arrayContaining([
        "A:15k_plus:asap=100",
        "A:15k_plus:operator=100",
        "B:10_15k_cash:few_weeks=90",
      ]),
    );
    // "No cash" never reaches a call, whatever the urgency.
    expect(
      cells
        .filter(
          (cell) => cell.invest === "no_cash" || cell.invest === "not_able",
        )
        .every((cell) => cell.band === "disqualify"),
    ).toBe(true);
    // The widening of 2026-07-28: $1k-$3k is no longer disqualifying by itself,
    // and with the most urgent timeline (40 + 15 = 55) it reaches a closer.
    expect(
      cells.find(
        (cell) =>
          cell.invest === "1_3k" &&
          cell.timeline === "asap" &&
          cell.variant === "A",
      )?.band,
    ).toBe("lane_1");
    // Everything below 31 is soft-redirected, nothing else is.
    for (const cell of cells) {
      if (!cell.disqualified) {
        expect(cell.band === "disqualify").toBe(cell.total <= 30);
      }
    }
  });
});

describe("thank-you links", () => {
  it("has a link entry for every state that has copy, and no others", () => {
    expect(Object.keys(THANK_YOU_STATE_LINKS).sort()).toEqual(
      Object.keys(THANK_YOU_STATES).sort(),
    );
  });

  it("points every state's CTAs at a link that exists and is an https URL", () => {
    for (const [state, links] of Object.entries(THANK_YOU_STATE_LINKS)) {
      for (const key of [links.primary, links.secondary]) {
        if (!key) continue;
        expect(THANK_YOU_LINKS, state).toHaveProperty(key);
        expect(THANK_YOU_LINKS[key], state).toMatch(/^https:\/\//);
      }
    }
  });

  it("gives a state a secondary link exactly when its copy has a secondary CTA", () => {
    for (const key of Object.keys(THANK_YOU_STATES) as ThankYouStateKey[]) {
      expect(Boolean(THANK_YOU_STATE_LINKS[key].secondary), key).toBe(
        Boolean(THANK_YOU_STATES[key].secondaryCta),
      );
    }
  });

  it("sends the not-right-time lead to the roadmap first and the setter calendar second", () => {
    expect(THANK_YOU_STATE_LINKS.not_right_time).toEqual({
      primary: "roadmapUrl",
      secondary: "setterCalendlyUrl",
    });
  });

  it("books each call-worthy band on a Calendly round robin, and the roadmap is the only non-calendar CTA", () => {
    for (const state of [
      "good_potential",
      "strong_fit",
      "perfect_fit",
    ] as const) {
      const url = THANK_YOU_LINKS[THANK_YOU_STATE_LINKS[state].primary];
      expect(url, state).toMatch(/^https:\/\/calendly\.com\//);
    }
    expect(THANK_YOU_LINKS.roadmapUrl).not.toMatch(/calendly\.com/);
  });

  it("keeps the setter calendar distinct from the closers' calendar", () => {
    expect(THANK_YOU_LINKS.setterCalendlyUrl).not.toBe(
      THANK_YOU_LINKS.lane1CalendlyUrl,
    );
    expect(THANK_YOU_LINKS.setterCalendlyUrl).not.toBe(
      THANK_YOU_LINKS.lane1TopCalendlyUrl,
    );
  });

  it("currently books strong fit and perfect fit on the same weighted round robin (2026-09-17)", () => {
    expect(THANK_YOU_LINKS.lane1CalendlyUrl).toBe(
      THANK_YOU_LINKS.lane1TopCalendlyUrl,
    );
  });
});

describe("thank-you link overrides", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("repoints one band from its env var without moving the others", async () => {
    const defaults = (await import("./thank-you-links")).THANK_YOU_LINKS;
    vi.resetModules();
    vi.stubEnv(
      "NEXT_PUBLIC_LANE_1_CALENDLY_URL",
      "https://calendly.com/d/override-lane-1",
    );

    const overridden = (await import("./thank-you-links")).THANK_YOU_LINKS;

    expect(overridden.lane1CalendlyUrl).toBe(
      "https://calendly.com/d/override-lane-1",
    );
    expect(overridden.lane1TopCalendlyUrl).toBe(defaults.lane1TopCalendlyUrl);
    expect(overridden.setterCalendlyUrl).toBe(defaults.setterCalendlyUrl);
    expect(overridden.roadmapUrl).toBe(defaults.roadmapUrl);
  });

  it("takes every override independently", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROADMAP_URL", "https://example.test/roadmap.pdf");
    vi.stubEnv(
      "NEXT_PUBLIC_SETTER_CALENDLY_URL",
      "https://calendly.com/d/setter-x",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_LANE_1_TOP_CALENDLY_URL",
      "https://calendly.com/d/top-x",
    );
    vi.resetModules();

    const links = (await import("./thank-you-links")).THANK_YOU_LINKS;

    expect(links).toMatchObject({
      roadmapUrl: "https://example.test/roadmap.pdf",
      setterCalendlyUrl: "https://calendly.com/d/setter-x",
      lane1TopCalendlyUrl: "https://calendly.com/d/top-x",
    });
  });
});
