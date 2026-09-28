import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "s3cret" as string | undefined },
  run: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/seo-trigger-job", () => ({
  runSeoTriggers: mocks.run,
}));

import { GET } from "./route";

const call = (auth = "Bearer s3cret") =>
  GET(
    new Request("https://x/api/admin/seo-triggers/run?full=1", {
      headers: { authorization: auth },
    }),
  );
const outcome = (error: string | null, rowsWritten = 0) => ({
  connector: { connector: "x", rowsWritten, error },
});

describe("/api/admin/seo-triggers/run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s without the cron bearer and runs nothing", async () => {
    expect((await call("Bearer wrong!")).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("is 200 on a clean or skipped run", async () => {
    mocks.run.mockResolvedValueOnce(outcome(null, 4));
    expect((await call()).status).toBe(200);
    mocks.run.mockResolvedValueOnce(outcome("skipped: table missing"));
    expect((await call()).status).toBe(200);
  });

  it("is 500 on a failed run or a throw, without leaking the message", async () => {
    mocks.run.mockResolvedValueOnce(outcome("DataForSEO 40200"));
    expect((await call()).status).toBe(500);
    mocks.run.mockRejectedValueOnce(new Error("secret detail"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
  });
});
