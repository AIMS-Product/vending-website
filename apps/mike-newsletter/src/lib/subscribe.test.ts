import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribe } from "./subscribe";

describe("subscribe request deadlines", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ACTIVECAMPAIGN_API_URL", "https://example.api-us1.com");
    vi.stubEnv("ACTIVECAMPAIGN_API_KEY", "key");
    vi.stubEnv("ACTIVECAMPAIGN_LIST_ID", "7");
    vi.stubEnv("ACTIVECAMPAIGN_TAG_ID", "9");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("attaches an abort signal to every ActiveCampaign call", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ contact: { id: "42" } }, { status: 200 }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockResolvedValueOnce(Response.json({}, { status: 200 }));

    await expect(subscribe("a@b.co", "hero")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("reports a provider error when the sync call times out", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("t", "TimeoutError"));
    await expect(subscribe("a@b.co", "hero")).resolves.toEqual({
      ok: false,
      reason: "provider",
    });
  });

  it("keeps the signup successful when only the tag call fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ contact: { id: "42" } }, { status: 200 }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 200 }))
      .mockRejectedValueOnce(new DOMException("t", "TimeoutError"));

    await expect(subscribe("a@b.co", "hero")).resolves.toEqual({ ok: true });
  });
});
