/**
 * VP lead qualification scoring engine.
 *
 * Pure, data-driven scoring for the two qualifying questions (timeline +
 * investment). Points, options, and thank-you copy live in the tables below so
 * they can be tuned without touching the logic. See
 * .claude/specs/2026-07-20-vp-qualification-scoring.md.
 *
 * NOTE: Variant B rungs and copy still need reconciliation with Kody (the form
 * list and scoring table disagree on the top rung). The scoring table is
 * treated as authoritative here.
 */

export type InvestVariant = "A" | "B";

export type QualificationBand =
  | "disqualify"
  | "setting"
  | "lane_1"
  | "top_closers";

export type ThankYouStateKey =
  | "not_right_time"
  | "good_potential"
  | "strong_fit"
  | "perfect_fit";

export type QualificationOption = {
  readonly value: string;
  readonly label: string;
  readonly points: number;
  /** When true, choosing this option forces a disqualify regardless of total. */
  readonly disqualifies?: boolean;
};

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

export const TIMELINE_OPTIONS: readonly QualificationOption[] = [
  { value: "asap", label: "As soon as possible", points: 40 },
  { value: "few_weeks", label: "In the next few weeks", points: 30 },
  { value: "1_3_months", label: "1–3 months out", points: 25 },
  { value: "unsure", label: "Still figuring that out", points: 10 },
];

export const INVEST_OPTIONS: Record<
  InvestVariant,
  readonly QualificationOption[]
> = {
  // Variant A — dollar ladder.
  A: [
    {
      value: "lt_3k",
      label: "Less than $3,000",
      points: 0,
      disqualifies: true,
    },
    { value: "3_5k", label: "$3,000 – $5,000", points: 20 },
    { value: "5_10k", label: "$5,000 – $10,000", points: 40 },
    { value: "10_15k", label: "$10,000 – $15,000", points: 50 },
    { value: "15k_plus", label: "$15,000+", points: 60 },
  ],
  // Variant B — capital posture.
  B: [
    {
      value: "10_15k_cash",
      label: "$10,000–$15,000 in cash ready to invest",
      points: 60,
    },
    {
      value: "5_10k_cash",
      label: "$5,000–$10,000 in cash ready to invest",
      points: 40,
    },
    {
      value: "1_2k_finance",
      label: "$1,000–$2,000 in cash, finance the rest",
      points: 30,
    },
    {
      value: "limited",
      label: "Limited capital, but willing to explore",
      points: 10,
    },
    {
      value: "not_able",
      label: "Not able to invest yet",
      points: 0,
      disqualifies: true,
    },
  ],
};

export type ThankYouState = {
  readonly label: string;
  readonly headline: string;
  readonly body: string;
  readonly cta: string;
  readonly secondaryCta?: string;
};

export const THANK_YOU_STATES: Record<ThankYouStateKey, ThankYouState> = {
  perfect_fit: {
    label: "Perfect fit",
    headline: "You're a perfect fit for vending.",
    body: "Your answers put you right where our most successful Vendingpreneurs started — capital ready and a clear timeline. There's no reason to wait. Let's get on a call and map your path to landing your first location.",
    cta: "Book my call",
  },
  strong_fit: {
    label: "Strong fit",
    headline: "You're a strong fit to launch.",
    body: "You've got what it takes to get started, and the timing lines up. A quick call is the fastest way to turn that into a real plan. Let's talk through your first move.",
    cta: "Book my call",
  },
  good_potential: {
    label: "Good potential",
    headline: "You're in a good spot to start.",
    body: "You're closer than most people realize. A few things are worth talking through before you commit, and that's exactly what this call is for. Book a quick intro and we'll help you figure out the right next step.",
    cta: "Book my 15-min call",
  },
  not_right_time: {
    label: "Not the right time yet",
    headline: "Now may not be the best time to launch a business.",
    body: "And that's okay. Based on your answers, jumping in right now could set you up to struggle instead of succeed. We'd rather help you get ready the right way. Grab our free 90-Day Startup Guide, and when you're set, book a session to map your path to launch.",
    cta: "Get the 90-Day Guide",
    secondaryCta: "Book a readiness session",
  },
};

const BAND_THANK_YOU: Record<QualificationBand, ThankYouStateKey> = {
  disqualify: "not_right_time",
  setting: "good_potential",
  lane_1: "strong_fit",
  top_closers: "perfect_fit",
};

export type ScoreInput = {
  timeline: string;
  invest: string;
  variant: InvestVariant;
};

export type ScoreResult = {
  timelinePoints: number;
  investPoints: number;
  total: number;
  /** True when a disqualifying option was chosen (overrides the score band). */
  disqualified: boolean;
  band: QualificationBand;
  thankYouState: ThankYouStateKey;
};

function findOption(
  options: readonly QualificationOption[],
  value: string,
  kind: string,
): QualificationOption {
  const option = options.find((candidate) => candidate.value === value);
  if (!option) {
    throw new ScoringError(`Unknown ${kind} option: ${value}`);
  }
  return option;
}

function bandFromScore(total: number): QualificationBand {
  if (total <= 39) return "disqualify";
  if (total <= 64) return "setting";
  if (total <= 84) return "lane_1";
  return "top_closers";
}

/**
 * Scores a qualification response. `total` is the sum of the two questions
 * (max 100). A disqualifying invest answer forces the `disqualify` band even
 * when the raw total would otherwise clear a higher threshold.
 */
export function scoreQualification(input: ScoreInput): ScoreResult {
  const investOptions = INVEST_OPTIONS[input.variant];
  if (!investOptions) {
    throw new ScoringError(`Unknown invest variant: ${input.variant}`);
  }

  const timelineOption = findOption(
    TIMELINE_OPTIONS,
    input.timeline,
    "timeline",
  );
  const investOption = findOption(investOptions, input.invest, "invest");

  const timelinePoints = timelineOption.points;
  const investPoints = investOption.points;
  const total = timelinePoints + investPoints;
  const disqualified = Boolean(investOption.disqualifies);
  const band = disqualified ? "disqualify" : bandFromScore(total);

  return {
    timelinePoints,
    investPoints,
    total,
    disqualified,
    band,
    thankYouState: BAND_THANK_YOU[band],
  };
}
