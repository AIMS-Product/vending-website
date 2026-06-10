import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_MAX_RETRIES,
  AUTOSAVE_RETRY_BACKOFF_MS,
  autosaveFailureMessage,
  autosaveFailureMode,
  nextAutosaveRetryDelayMs,
} from "./autosave-retry-policy";

describe("nextAutosaveRetryDelayMs", () => {
  it("returns increasing backoff delays for each retry until the cap", () => {
    expect(nextAutosaveRetryDelayMs(0)).toBe(AUTOSAVE_RETRY_BACKOFF_MS[0]);
    expect(nextAutosaveRetryDelayMs(1)).toBe(AUTOSAVE_RETRY_BACKOFF_MS[1]);
    expect(nextAutosaveRetryDelayMs(2)).toBe(AUTOSAVE_RETRY_BACKOFF_MS[2]);
  });

  it("returns null once the retry cap is reached (rest, no storm)", () => {
    expect(nextAutosaveRetryDelayMs(AUTOSAVE_MAX_RETRIES)).toBeNull();
    expect(nextAutosaveRetryDelayMs(AUTOSAVE_MAX_RETRIES + 5)).toBeNull();
  });

  it("delays are monotonically non-decreasing (real backoff, not flat)", () => {
    for (let i = 1; i < AUTOSAVE_RETRY_BACKOFF_MS.length; i++) {
      expect(AUTOSAVE_RETRY_BACKOFF_MS[i]).toBeGreaterThanOrEqual(
        AUTOSAVE_RETRY_BACKOFF_MS[i - 1],
      );
    }
  });
});

describe("autosaveFailureMode", () => {
  it("is retrying below the cap and exhausted at/after it", () => {
    expect(autosaveFailureMode(0)).toBe("retrying");
    expect(autosaveFailureMode(AUTOSAVE_MAX_RETRIES - 1)).toBe("retrying");
    expect(autosaveFailureMode(AUTOSAVE_MAX_RETRIES)).toBe("exhausted");
  });
});

describe("autosaveFailureMessage", () => {
  it("never claims the work is saved and always offers manual save", () => {
    const retrying = autosaveFailureMessage("retrying");
    const exhausted = autosaveFailureMessage("exhausted");
    for (const msg of [retrying, exhausted]) {
      expect(msg.toLowerCase()).toContain("save");
      expect(msg.toLowerCase()).not.toMatch(/\bsaved\b/);
    }
    expect(retrying.toLowerCase()).toContain("retr");
    expect(exhausted.toLowerCase()).toContain("manual");
  });
});
