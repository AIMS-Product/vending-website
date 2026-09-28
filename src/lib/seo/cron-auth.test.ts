import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "s3cret" as string | undefined },
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));

import { rejectUnlessCron, runFailed } from "./cron-auth";

const req = (auth?: string) =>
  new Request("https://x/api/admin/seo-ranks/run", {
    headers: auth ? { authorization: auth } : {},
  });

describe("rejectUnlessCron", () => {
  it("503s while CRON_SECRET is unset", () => {
    mocks.config.CRON_SECRET = undefined;
    expect(rejectUnlessCron(req("Bearer s3cret"), "SEO rank")?.status).toBe(
      503,
    );
    mocks.config.CRON_SECRET = "s3cret";
  });

  it("401s a missing, wrong or differently sized bearer", () => {
    for (const auth of [undefined, "Bearer nope!!", "Bearer s3cre", "s3cret"]) {
      expect(
        rejectUnlessCron(req(auth), "SEO rank")?.status,
        String(auth),
      ).toBe(401);
    }
  });

  it("lets the right bearer through", () => {
    expect(rejectUnlessCron(req("Bearer s3cret"), "SEO rank")).toBeNull();
  });
});

describe("runFailed", () => {
  it("counts only an unskipped error that wrote nothing", () => {
    expect(runFailed({ rowsWritten: 0, error: "boom" })).toBe(true);
    expect(runFailed({ rowsWritten: 0, error: "skipped: not set" })).toBe(
      false,
    );
    expect(runFailed({ rowsWritten: 5, error: "2 failed" })).toBe(false);
    expect(runFailed({ rowsWritten: 0, error: null })).toBe(false);
  });
});
