/**
 * The nightly self-audit's pure half: how a stored number is judged against
 * the number its source system reports.
 *
 * Every check answers one question — "does what we stored still equal what the
 * source says?" — for one window. A check that cannot reach its source is
 * `skipped`, never a silent pass: an unreachable source is an unverified
 * number, and the report says so.
 */

export type AuditStatus = "pass" | "warn" | "fail" | "skipped" | "error";

export type AuditResult = {
  /** Stable id, so history lines up across runs. */
  checkId: string;
  label: string;
  /** Human window, e.g. "yesterday (2026-09-18)". */
  window: string;
  /** The system the check asked. */
  sourceName: string;
  ours: number | null;
  source: number | null;
  diffPct: number | null;
  status: AuditStatus;
  detail: string;
};

export type CompareInput = {
  checkId: string;
  label: string;
  window: string;
  sourceName: string;
  ours: number | null;
  source: number | null;
  /** Percent difference tolerated before the check warns. */
  tolerancePct: number;
  /** Rounds money to cents in the detail line. */
  unit?: "count" | "money";
  /** Appended to the detail line, whatever the outcome. */
  note?: string;
};

const FAIL_MULTIPLIER = 2;

/** Judges one stored number against its source. Never throws. */
export function compare(input: CompareInput): AuditResult {
  const { ours, source } = input;
  const base = {
    checkId: input.checkId,
    label: input.label,
    window: input.window,
    sourceName: input.sourceName,
    ours,
    source,
  };
  const suffix = input.note ? ` ${input.note}` : "";

  if (ours === null || source === null) {
    const missing = ours === null ? "we stored nothing" : "the source";
    return {
      ...base,
      diffPct: null,
      status: "skipped",
      detail:
        ours === null && source === null
          ? `Neither side reported a number, so nothing was verified.${suffix}`
          : `Not compared: ${missing} reported no number.${suffix}`,
    };
  }

  const format = (value: number) =>
    input.unit === "money"
      ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : value.toLocaleString("en-US");

  if (ours === 0 && source === 0) {
    return {
      ...base,
      diffPct: 0,
      status: "pass",
      detail: `Both sides report nothing for this window.${suffix}`,
    };
  }

  // Against the source, not against the larger of the two: the source is what
  // the number is supposed to equal.
  const diffPct = source === 0 ? 100 : ((ours - source) / source) * 100;
  const size = Math.abs(diffPct);
  const status: AuditStatus =
    size <= input.tolerancePct
      ? "pass"
      : size <= input.tolerancePct * FAIL_MULTIPLIER
        ? "warn"
        : "fail";
  const direction = ours > source ? "above" : "below";
  const detail =
    status === "pass"
      ? `Ours ${format(ours)} vs ${input.sourceName} ${format(source)} (${round1(diffPct)}%).${suffix}`
      : `Ours ${format(ours)} is ${round1(size)}% ${direction} ${input.sourceName}'s ${format(source)}.${suffix}`;

  return { ...base, diffPct: round1(diffPct), status, detail };
}

/** A check that reached no verdict because its source threw. */
export function errorResult(
  checkId: string,
  label: string,
  window: string,
  sourceName: string,
  error: unknown,
): AuditResult {
  return {
    checkId,
    label,
    window,
    sourceName,
    ours: null,
    source: null,
    diffPct: null,
    status: "error",
    detail: `Could not check: ${error instanceof Error ? error.message : String(error)}`,
  };
}

/** A check that answers yes/no rather than comparing two numbers. */
export function assertion(input: {
  checkId: string;
  label: string;
  window: string;
  sourceName: string;
  ok: boolean;
  /** Warns instead of failing when the assertion does not hold. */
  warnOnly?: boolean;
  count?: number | null;
  detail: string;
}): AuditResult {
  return {
    checkId: input.checkId,
    label: input.label,
    window: input.window,
    sourceName: input.sourceName,
    ours: input.count ?? null,
    source: null,
    diffPct: null,
    status: input.ok ? "pass" : input.warnOnly ? "warn" : "fail",
    detail: input.detail,
  };
}

export type AuditSummary = {
  status: AuditStatus;
  counts: Record<AuditStatus, number>;
  /** One plain-English line: what a reader needs before the table. */
  headline: string;
  /** Checks that need a human, worst first. */
  problems: AuditResult[];
};

const SEVERITY: Record<AuditStatus, number> = {
  fail: 0,
  error: 1,
  warn: 2,
  skipped: 3,
  pass: 4,
};

export function summariseAudit(results: readonly AuditResult[]): AuditSummary {
  const counts: Record<AuditStatus, number> = {
    pass: 0,
    warn: 0,
    fail: 0,
    skipped: 0,
    error: 0,
  };
  for (const result of results) counts[result.status] += 1;

  const problems = results
    .filter((result) => result.status !== "pass")
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status]);

  const status: AuditStatus =
    counts.fail > 0
      ? "fail"
      : counts.error > 0
        ? "error"
        : counts.warn > 0
          ? "warn"
          : counts.skipped > 0
            ? "skipped"
            : "pass";

  const total = results.length;
  const headline =
    total === 0
      ? "No checks ran."
      : status === "pass"
        ? `All ${total} checks agree with their source systems.`
        : [
            counts.fail > 0
              ? `${counts.fail} number does not match its source`
              : null,
            counts.error > 0
              ? `${counts.error} source could not be reached`
              : null,
            counts.warn > 0 ? `${counts.warn} drifting` : null,
            counts.skipped > 0 ? `${counts.skipped} not verified` : null,
          ]
            .filter(Boolean)
            .join(", ")
            .replace(/^./, (character) => character.toUpperCase()) +
          ` (${counts.pass} of ${total} agree).`;

  return { status, counts, headline, problems };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
