import { describe, expect, it } from "vitest";
import {
  assignInvestVariant,
  deriveQualificationScore,
  INVEST_OPTIONS,
  INVEST_ROLE,
  scoreQualification,
  ScoringError,
  THANK_YOU_STATES,
  TIMELINE_OPTIONS,
  TIMELINE_ROLE,
} from "./scoring";

describe("scoreQualification", () => {
  it("scores a top-closer lead (capital + urgency both high) as a perfect fit", () => {
    const result = scoreQualification({
      timeline: "asap",
      invest: "15k_plus",
      variant: "A",
    });

    expect(result).toMatchObject({
      timelinePoints: 40,
      investPoints: 60,
      total: 100,
      disqualified: false,
      band: "top_closers",
      thankYouState: "perfect_fit",
    });
  });

  it("scores a strong Lane 1 lead", () => {
    const result = scoreQualification({
      timeline: "asap",
      invest: "5_10k",
      variant: "A",
    });

    expect(result.total).toBe(80);
    expect(result.band).toBe("lane_1");
    expect(result.thankYouState).toBe("strong_fit");
  });

  it("scores a mid lead to the setting team", () => {
    const result = scoreQualification({
      timeline: "1_3_months",
      invest: "3_5k",
      variant: "A",
    });

    expect(result.total).toBe(45);
    expect(result.band).toBe("setting");
    expect(result.thankYouState).toBe("good_potential");
  });

  it("disqualifies a low-score lead by total alone", () => {
    const result = scoreQualification({
      timeline: "unsure",
      invest: "3_5k",
      variant: "A",
    });

    expect(result.total).toBe(30);
    expect(result.disqualified).toBe(false);
    expect(result.band).toBe("disqualify");
    expect(result.thankYouState).toBe("not_right_time");
  });

  it("auto-disqualifies a disqualifying invest answer even when the total clears the setting threshold", () => {
    // asap(40) + <$3k(0, disqualifies) = 40, which would be "setting" by score,
    // but the invest answer forces a disqualify.
    const result = scoreQualification({
      timeline: "asap",
      invest: "lt_3k",
      variant: "A",
    });

    expect(result.total).toBe(40);
    expect(result.disqualified).toBe(true);
    expect(result.band).toBe("disqualify");
    expect(result.thankYouState).toBe("not_right_time");
  });

  it("treats a score of exactly 40 (non-disqualifying) as the setting band, not disqualify", () => {
    const result = scoreQualification({
      timeline: "unsure",
      invest: "1_2k_finance",
      variant: "B",
    });

    expect(result.total).toBe(40);
    expect(result.disqualified).toBe(false);
    expect(result.band).toBe("setting");
  });

  it("scores variant B capital-posture answers", () => {
    const perfect = scoreQualification({
      timeline: "asap",
      invest: "10_15k_cash",
      variant: "B",
    });
    expect(perfect.total).toBe(100);
    expect(perfect.band).toBe("top_closers");

    const disq = scoreQualification({
      timeline: "few_weeks",
      invest: "not_able",
      variant: "B",
    });
    expect(disq.disqualified).toBe(true);
    expect(disq.band).toBe("disqualify");
  });

  it("throws for an unknown timeline or invest option", () => {
    expect(() =>
      scoreQualification({
        timeline: "nope",
        invest: "15k_plus",
        variant: "A",
      }),
    ).toThrow(ScoringError);
    expect(() =>
      scoreQualification({ timeline: "asap", invest: "nope", variant: "A" }),
    ).toThrow(ScoringError);
  });
});

describe("scoring option tables", () => {
  it("keeps timeline points within the documented 10–40 range", () => {
    const points = TIMELINE_OPTIONS.map((option) => option.points);
    expect(Math.max(...points)).toBe(40);
    expect(Math.min(...points)).toBe(10);
  });

  it("marks exactly one disqualifying invest option per variant", () => {
    for (const variant of ["A", "B"] as const) {
      const disqualifiers = INVEST_OPTIONS[variant].filter(
        (option) => option.disqualifies,
      );
      expect(disqualifiers).toHaveLength(1);
      expect(disqualifiers[0]?.points).toBe(0);
    }
  });

  it("has a thank-you state for every band", () => {
    for (const key of [
      "perfect_fit",
      "strong_fit",
      "good_potential",
      "not_right_time",
    ] as const) {
      expect(THANK_YOU_STATES[key].cta).toBeTruthy();
      expect(THANK_YOU_STATES[key].headline).toBeTruthy();
    }
  });
});

describe("deriveQualificationScore", () => {
  it("scores from a normalized summary + variant key", () => {
    const result = deriveQualificationScore(
      { [TIMELINE_ROLE]: "asap", [INVEST_ROLE]: "15k_plus" },
      "A",
    );

    expect(result?.total).toBe(100);
    expect(result?.band).toBe("top_closers");
  });

  it("returns null when the timeline or invest answer is missing", () => {
    expect(
      deriveQualificationScore({ [TIMELINE_ROLE]: "asap" }, "A"),
    ).toBeNull();
    expect(
      deriveQualificationScore({ [INVEST_ROLE]: "15k_plus" }, "A"),
    ).toBeNull();
    expect(deriveQualificationScore(null, "A")).toBeNull();
  });

  it("returns null when there is no valid A/B variant", () => {
    expect(
      deriveQualificationScore(
        { [TIMELINE_ROLE]: "asap", [INVEST_ROLE]: "15k_plus" },
        null,
      ),
    ).toBeNull();
    expect(
      deriveQualificationScore(
        { [TIMELINE_ROLE]: "asap", [INVEST_ROLE]: "15k_plus" },
        "C",
      ),
    ).toBeNull();
  });

  it("returns null (does not throw) for option values the engine doesn't know", () => {
    expect(
      deriveQualificationScore(
        { [TIMELINE_ROLE]: "asap", [INVEST_ROLE]: "made_up_value" },
        "A",
      ),
    ).toBeNull();
  });
});

describe("assignInvestVariant", () => {
  it("is deterministic for a given seed", () => {
    expect(assignInvestVariant("session-abc")).toBe(
      assignInvestVariant("session-abc"),
    );
  });

  it("only ever returns A or B", () => {
    for (const seed of ["a", "b", "c", "session-1", "vp-xyz", "", "12345"]) {
      expect(["A", "B"]).toContain(assignInvestVariant(seed));
    }
  });

  it("splits a population of seeds across both variants", () => {
    const seeds = Array.from({ length: 200 }, (_, index) => `session-${index}`);
    const variants = seeds.map(assignInvestVariant);
    expect(variants).toContain("A");
    expect(variants).toContain("B");
    const aCount = variants.filter((variant) => variant === "A").length;
    // Roughly balanced — guard against a degenerate all-A / all-B assignment.
    expect(aCount).toBeGreaterThan(50);
    expect(aCount).toBeLessThan(150);
  });
});
