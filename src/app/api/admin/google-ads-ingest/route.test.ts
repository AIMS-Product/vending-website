import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => {
  class GoogleAdsIngestError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }
  return {
    GoogleAdsIngestError,
    ingestGoogleAdsBatch: vi.fn(),
    config: { GOOGLE_ADS_SYNC_SECRET: "s3cret" as string | undefined },
  };
});

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/google-ads-ingest", () => ({
  GoogleAdsIngestError: mocks.GoogleAdsIngestError,
  ingestGoogleAdsBatch: mocks.ingestGoogleAdsBatch,
}));

const request = (body: string, authorization?: string) =>
  new Request("https://www.vendingpreneurs.com/api/admin/google-ads-ingest", {
    method: "POST",
    headers: authorization ? { authorization } : {},
    body,
  });

describe("POST /api/admin/google-ads-ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.GOOGLE_ADS_SYNC_SECRET = "s3cret";
    mocks.ingestGoogleAdsBatch.mockResolvedValue({
      report: "campaign",
      upserted: 2,
    });
  });

  it("fails closed when the secret is not configured", async () => {
    mocks.config.GOOGLE_ADS_SYNC_SECRET = undefined;
    const res = await POST(request("{}", "Bearer s3cret"));
    expect(res.status).toBe(503);
    expect(mocks.ingestGoogleAdsBatch).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer", async () => {
    expect((await POST(request("{}"))).status).toBe(401);
    expect((await POST(request("{}", "Bearer nope"))).status).toBe(401);
    expect(mocks.ingestGoogleAdsBatch).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    expect((await POST(request("not json", "Bearer s3cret"))).status).toBe(400);
  });

  it("passes the batch through and reports the row count", async () => {
    const res = await POST(
      request('{"report":"campaign","rows":[]}', "Bearer s3cret"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      report: "campaign",
      upserted: 2,
    });
  });

  it("maps an ingest error to its status", async () => {
    mocks.ingestGoogleAdsBatch.mockRejectedValue(
      new mocks.GoogleAdsIngestError("bad", 400),
    );
    expect((await POST(request("{}", "Bearer s3cret"))).status).toBe(400);
  });
});
