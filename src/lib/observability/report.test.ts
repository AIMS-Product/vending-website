import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => sentry);

import { reportCronException, reportCronRunFailure } from "./cron-failure";
import { messageFreeError, reportRouteError } from "./route-error";

describe("cron failure reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentry.flush.mockResolvedValue(true);
  });

  it("captures a thrown error tagged and grouped by job, then flushes", async () => {
    await reportCronException("ga4-sync", new TypeError("boom"));
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      level: "error",
      tags: { cron: "ga4-sync", cron_failure: "exception" },
      fingerprint: ["cron-failure", "ga4-sync"],
    });
    expect(sentry.flush).toHaveBeenCalledWith(2000);
  });

  it("does not send the original error message", () => {
    const secret = new Error("invalid_grant for private_key -----BEGIN KEY");
    const safe = messageFreeError("cron ga4-sync", secret);
    expect(safe.name).toBe("Error");
    expect(safe.message).toBe("cron ga4-sync threw Error");
    expect(safe.stack).not.toContain("private_key");
    expect(safe.stack).toContain("    at ");
  });

  it("copes with a thrown non-Error", () => {
    const safe = messageFreeError("x", "raw string with a@b.com");
    expect(safe.name).toBe("UnknownError");
    expect(`${safe.message}${safe.stack}`).not.toContain("a@b.com");
  });

  it("captures a non-throwing run failure as a message", async () => {
    await reportCronRunFailure("ghl-sync", "forms");
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "cron ghl-sync finished with a failure: forms",
      expect.objectContaining({
        tags: { cron: "ghl-sync", cron_failure: "run" },
      }),
    );
    expect(sentry.flush).toHaveBeenCalled();
  });

  it("never throws when Sentry itself fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sentry.captureException.mockImplementation(() => {
      throw new Error("sdk down");
    });
    await expect(reportCronException("x", new Error("e"))).resolves.toBe(
      undefined,
    );
    sentry.captureException.mockReset();
    sentry.flush.mockRejectedValue(new Error("flush failed"));
    await expect(reportCronException("x", new Error("e"))).resolves.toBe(
      undefined,
    );
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("reports a caught route error with only class and route name", async () => {
    await reportRouteError("reporting-kpi", new Error("user a@b.com failed"));
    const [sent, options] = sentry.captureException.mock.calls[0];
    expect(`${sent.message}${sent.stack}`).not.toContain("a@b.com");
    expect(options.tags).toEqual({ route: "reporting-kpi" });
    expect(sentry.flush).toHaveBeenCalled();
  });

  it("route reporting never throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sentry.captureException.mockImplementation(() => {
      throw new Error("sdk down");
    });
    await expect(reportRouteError("x", new Error("e"))).resolves.toBe(
      undefined,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
