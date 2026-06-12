import { describe, expect, it, vi } from "vitest";
import { pollUntilLive } from "./live-page-poll";
import { isPublishJustSucceeded } from "./publish-success-state";

function jsonResponse(ok: boolean) {
  return { ok } as Response;
}

describe("pollUntilLive", () => {
  it("returns live immediately when the first probe responds 200", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(true));
    const sleep = vi.fn(async () => {});
    const result = await pollUntilLive("/resources/x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });
    expect(result).toBe("live");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries with backoff until the route becomes live", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse(calls >= 3); // 404, 404, then 200
    });
    const sleep = vi.fn(async () => {});
    const result = await pollUntilLive("/resources/x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      backoffMs: [10, 10, 10],
    });
    expect(result).toBe("live");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("times out after exhausting the backoff schedule while still 404", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(false));
    const sleep = vi.fn(async () => {});
    const result = await pollUntilLive("/resources/x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      backoffMs: [10, 10],
    });
    expect(result).toBe("timed-out");
    // first probe + 2 retries
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("treats fetch rejection (network error) as not-yet-live and keeps polling", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network");
      return jsonResponse(true);
    });
    const result = await pollUntilLive("/resources/x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
      backoffMs: [10],
    });
    expect(result).toBe("live");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops early when the abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => jsonResponse(false));
    const result = await pollUntilLive("/resources/x", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
      backoffMs: [10, 10],
      signal: controller.signal,
    });
    // The first probe still runs, but no retries after abort.
    expect(result).toBe("timed-out");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("isPublishJustSucceeded", () => {
  it("is true only after a successful manual publish", () => {
    expect(
      isPublishJustSucceeded({
        stateStatus: "saved",
        lastManualSubmitIntent: "publish",
      }),
    ).toBe(true);
  });

  it("is false for a successful manual save (not a publish)", () => {
    expect(
      isPublishJustSucceeded({
        stateStatus: "saved",
        lastManualSubmitIntent: "save",
      }),
    ).toBe(false);
  });

  it("is false while the publish is still pending or errored", () => {
    expect(
      isPublishJustSucceeded({
        stateStatus: "idle",
        lastManualSubmitIntent: "publish",
      }),
    ).toBe(false);
    expect(
      isPublishJustSucceeded({
        stateStatus: "error",
        lastManualSubmitIntent: "publish",
      }),
    ).toBe(false);
  });
});
