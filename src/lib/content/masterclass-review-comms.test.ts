import { describe, expect, it } from "vitest";
import {
  COMMS_MESSAGES,
  COMMS_PHASES,
  LAUNCH_CHECKLIST,
  SWAP_ROWS,
} from "./masterclass-review-comms";

describe("team briefing: every message", () => {
  it("lists every captured text and email once", () => {
    const ids = COMMS_MESSAGES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The comms map (2026-10-01) holds 19 texts and 27 emails.
    expect(COMMS_MESSAGES.filter((m) => m.channel === "sms").length).toBe(19);
    expect(COMMS_MESSAGES.filter((m) => m.channel === "email").length).toBe(27);
  });

  it("gives every message a body, a time and a known branch", () => {
    const phases = new Set(COMMS_PHASES.map((p) => p.id));
    for (const m of COMMS_MESSAGES) {
      expect(m.body.trim(), m.id).not.toBe("");
      expect(m.when.trim(), m.id).not.toBe("");
      expect(phases.has(m.phase), m.id).toBe(true);
    }
  });

  it("never leaves a problem without an owner and a date", () => {
    const flagged = COMMS_MESSAGES.filter((m) => m.flag);
    expect(flagged.length).toBeGreaterThan(0);
    for (const m of flagged) {
      expect(m.flag?.fix.trim(), m.id).not.toBe("");
      expect(m.flag?.due.trim(), m.id).not.toBe("");
    }
  });

  it("puts no raw merge tags or live links in the copy", () => {
    for (const m of COMMS_MESSAGES) {
      expect(m.body, m.id).not.toMatch(/\{\{|https?:\/\//);
    }
  });
});

describe("team briefing: swap map and checklist", () => {
  it("covers each journey step and every open line has an owner and date", () => {
    expect(SWAP_ROWS.length).toBeGreaterThanOrEqual(8);
    for (const item of LAUNCH_CHECKLIST) {
      expect(item.due.trim(), item.item).not.toBe("");
    }
    const keys = LAUNCH_CHECKLIST.map((i) => i.item);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
