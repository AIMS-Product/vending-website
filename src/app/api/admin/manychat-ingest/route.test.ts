import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => {
  class ManychatIngestError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = "ManychatIngestError";
      this.status = status;
    }
  }
  return {
    ManychatIngestError,
    ingestManychatEvent: vi.fn(),
    config: { MANYCHAT_INGEST_SECRET: "s3cret" as string | undefined },
  };
});

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/manychat-ingest", () => ({
  ManychatIngestError: mocks.ManychatIngestError,
  ingestManychatEvent: mocks.ingestManychatEvent,
}));

function request(body: string, authorization?: string) {
  return new Request(
    "https://www.vendingpreneurs.com/api/admin/manychat-ingest",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body,
    },
  );
}

describe("POST /api/admin/manychat-ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.MANYCHAT_INGEST_SECRET = "s3cret";
    mocks.ingestManychatEvent.mockResolvedValue({
      day: "2026-09-11",
      event: "call_booked",
      enriched: true,
    });
  });

  it("answers 503 when the secret is not configured", async () => {
    mocks.config.MANYCHAT_INGEST_SECRET = undefined;
    expect((await POST(request("{}", "Bearer s3cret"))).status).toBe(503);
  });

  it("rejects a missing or wrong bearer", async () => {
    expect((await POST(request("{}"))).status).toBe(401);
    expect((await POST(request("{}", "Bearer nope"))).status).toBe(401);
    expect(mocks.ingestManychatEvent).not.toHaveBeenCalled();
  });

  it("hands a valid body to the service and reports the result", async () => {
    const body = { subscriber_id: "1", event: "call_booked" };
    const response = await POST(request(JSON.stringify(body), "Bearer s3cret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      day: "2026-09-11",
      event: "call_booked",
      enriched: true,
    });
    expect(mocks.ingestManychatEvent).toHaveBeenCalledWith(body);
  });

  it("returns the service's status for a rejected payload", async () => {
    mocks.ingestManychatEvent.mockRejectedValue(
      new mocks.ManychatIngestError("Invalid payload at event: bad", 400),
    );
    const response = await POST(request("{}", "Bearer s3cret"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("answers 400 for a body that is not JSON", async () => {
    expect((await POST(request("not json", "Bearer s3cret"))).status).toBe(400);
  });
});
