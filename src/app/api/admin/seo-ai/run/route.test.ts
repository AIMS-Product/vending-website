import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: { CRON_SECRET: "s3cret" as string | undefined },
  run: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/seo-ai-sync", () => ({
  AI_ENGINES: ["ai_mode", "chatgpt", "youtube", "mentions"],
  syncSeoAi: mocks.run,
}));

import { GET } from "./route";

const call = (engine: string, auth = "Bearer s3cret") =>
  GET(
    new Request(`https://x/api/admin/seo-ai/run?engine=${engine}`, {
      headers: { authorization: auth },
    }),
  );

describe("/api/admin/seo-ai/run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s without the cron bearer and 400s on an unknown engine", async () => {
    expect((await call("ai_mode", "Bearer nope")).status).toBe(401);
    expect((await call("bing")).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs the named engine; 500 on a failed run", async () => {
    mocks.run.mockResolvedValueOnce({
      connector: { connector: "x", rowsWritten: 3, error: null },
    });
    expect((await call("youtube")).status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith({ engine: "youtube" });
    mocks.run.mockResolvedValueOnce({
      connector: { connector: "x", rowsWritten: 0, error: "boom" },
    });
    expect((await call("chatgpt")).status).toBe(500);
  });
});
