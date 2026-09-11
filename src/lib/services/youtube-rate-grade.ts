/**
 * Grading a video's conversion rate against the rest of the table.
 *
 * The question this answers is "which of my videos should I make more of",
 * which is a comparison, not an absolute. There is no industry number for what
 * a good visit-to-lead rate is on a vending channel, and inventing one would
 * dress a guess up as a benchmark. Each rate is compared to the median of the
 * other videos in the same range instead, so the scale re-calibrates as the
 * channel improves.
 *
 * Small denominators are deliberately left ungraded. One booked call out of two
 * is a 50% close rate that means nothing, and colouring it green is exactly how
 * a report talks somebody into doubling down on noise.
 */

export type RateGrade = "good" | "ok" | "poor" | null;

/**
 * Denominator below which a rate is reported but never graded.
 *
 * Five is low for statistics and about right for judgement: it is enough to
 * separate a video that converts from one that does not, and small enough that
 * most of a real table still gets a colour.
 */
export const MIN_GRADED_SAMPLE = 5;

/** Fewer comparable videos than this and there is no meaningful median. */
const MIN_GRADED_ROWS = 3;

/** How far from the median a rate travels before it is worth pointing at. */
const GOOD_MULTIPLE = 1.25;
const POOR_MULTIPLE = 0.75;

export type RateInput = {
  /** The percentage itself, or null when the stage was never measured. */
  value: number | null;
  /** What the percentage was computed over — leads, visits, booked calls. */
  sample: number | null;
};

/**
 * One grade per input, in the order given.
 *
 * Ungraded (null) means "shown, not judged": either the rate is unmeasured, the
 * denominator is too small to read anything into, or too few videos in this
 * range carry the stage for a median to mean anything.
 */
export function gradeRates(inputs: RateInput[]): RateGrade[] {
  const gradable = inputs.map(
    (input) =>
      input.value !== null &&
      input.sample !== null &&
      input.sample >= MIN_GRADED_SAMPLE,
  );

  const comparable = inputs
    .filter((_, index) => gradable[index])
    .map((input) => input.value as number);

  if (comparable.length < MIN_GRADED_ROWS) return inputs.map(() => null);

  const mid = median(comparable);
  // Every comparable rate is zero: nothing here is better or worse than
  // anything else, and a table of green zeroes would be a lie.
  if (mid === 0) return inputs.map(() => null);

  return inputs.map((input, index) => {
    if (!gradable[index]) return null;
    const value = input.value as number;
    if (value >= mid * GOOD_MULTIPLE) return "good";
    if (value <= mid * POOR_MULTIPLE) return "poor";
    return "ok";
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : (sorted[middle] as number);
}
