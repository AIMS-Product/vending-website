import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => {
  class WebinarIngestError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = "WebinarIngestError";
      this.status = status;
    }
  }
  return {
    WebinarIngestError,
    ingestWebinarSnapshot: vi.fn(),
    config: { WEBINAR_INGEST_SECRET: "s3cret" as string | undefined },
  };
});

vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/webinar-ingest", () => ({
  WebinarIngestError: mocks.WebinarIngestError,
  ingestWebinarSnapshot: mocks.ingestWebinarSnapshot,
}));

function request(body: string, authorization?: string) {
  return new Request(
    "https://www.vendingpreneurs.com/api/admin/webinar-ingest",
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

describe("POST /api/admin/webinar-ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.WEBINAR_INGEST_SECRET = "s3cret";
    mocks.ingestWebinarSnapshot.mockResolvedValue({
      webinarsWritten: 10,
      audiencesWritten: 30,
    });
  });

  it("answers 503 when the secret is not configured", async () => {
    mocks.config.WEBINAR_INGEST_SECRET = undefined;
    const response = await POST(request("{}", "Bearer s3cret"));
    expect(response.status).toBe(503);
  });

  it("rejects a missing or wrong bearer", async () => {
    expect((await POST(request("{}"))).status).toBe(401);
    expect((await POST(request("{}", "Bearer nope"))).status).toBe(401);
    expect(mocks.ingestWebinarSnapshot).not.toHaveBeenCalled();
  });

  it("hands a valid body to the service and reports rows written", async () => {
    const response = await POST(
      request(JSON.stringify({ version: 1 }), "Bearer s3cret"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      webinarsWritten: 10,
      audiencesWritten: 30,
    });
    expect(mocks.ingestWebinarSnapshot).toHaveBeenCalledWith({ version: 1 });
  });

  it("returns the service's status for a rejected payload", async () => {
    mocks.ingestWebinarSnapshot.mockRejectedValue(
      new mocks.WebinarIngestError("Invalid payload at version: bad", 400),
    );
    const response = await POST(request("{}", "Bearer s3cret"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: "Invalid payload at version: bad",
    });
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await POST(request("not json", "Bearer s3cret"));
    expect(response.status).toBe(400);
  });
});
