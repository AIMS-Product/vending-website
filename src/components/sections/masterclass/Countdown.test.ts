import { describe, expect, it } from "vitest";
import { countdownPhase, timerLabelProps } from "./Countdown";

const START = "2026-10-06T00:30:00.000Z";
const at = (offsetMs: number) => Date.parse(START) + offsetMs;

describe("countdownPhase", () => {
  it("counts down before the start", () => {
    expect(countdownPhase(at(-5_000), START)).toEqual({
      phase: "counting",
      left: 5_000,
    });
  });

  it("keeps the expired label after the target when endsAt is omitted", () => {
    expect(countdownPhase(at(0), START, undefined, "Replay expired")).toEqual({
      phase: "label",
    });
    expect(
      countdownPhase(at(30 * 86_400_000), START, undefined, "Replay expired"),
    ).toEqual({ phase: "label" });
  });

  it("shows the label only inside the live window when endsAt is set", () => {
    const end = new Date(at(75 * 60_000)).toISOString();
    expect(countdownPhase(at(60_000), START, end, "Live now")).toEqual({
      phase: "label",
    });
    expect(countdownPhase(at(75 * 60_000), START, end, "Live now")).toEqual({
      phase: "none",
    });
  });

  it("renders nothing on expiry without a label", () => {
    expect(countdownPhase(at(0), START)).toEqual({ phase: "none" });
  });
});

describe("timerLabelProps", () => {
  it("names the timer only when a label is given", () => {
    expect(timerLabelProps("Time until the masterclass starts")).toEqual({
      "aria-label": "Time until the masterclass starts",
    });
    expect(timerLabelProps()).toEqual({});
  });
});
