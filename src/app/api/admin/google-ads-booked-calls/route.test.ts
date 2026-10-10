import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  config: { GOOGLE_ADS_SYNC_SECRET: "s3cret" as string | undefined },
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/google-ads-booked-calls", () => ({
  loadBookedCallConversions: mocks.load,
}));

const req = (auth?: string, q = "") =>
  new Request(
    `https://www.vendingpreneurs.com/api/admin/google-ads-booked-calls${q}`,
    {
      headers: auth ? { authorization: auth } : {},
    },
  );

describe("GET /api/admin/google-ads-booked-calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.GOOGLE_ADS_SYNC_SECRET = "s3cret";
    mocks.load.mockResolvedValue([{ gclid: "g", conversionTime: "t" }]);
  });

  it("fails closed without a secret and rejects a wrong bearer", async () => {
    mocks.config.GOOGLE_ADS_SYNC_SECRET = undefined;
    expect((await GET(req("Bearer s3cret"))).status).toBe(503);
    mocks.config.GOOGLE_ADS_SYNC_SECRET = "s3cret";
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("returns conversions for the requested window", async () => {
    const res = await GET(req("Bearer s3cret", "?days=90"));
    expect(res.status).toBe(200);
    expect(mocks.load).toHaveBeenCalledWith(90);
    expect(await res.json()).toEqual({
      ok: true,
      conversions: [{ gclid: "g", conversionTime: "t" }],
    });
  });
});
