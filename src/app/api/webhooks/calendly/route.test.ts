import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SIGNING_KEY = "whsec_route_test_key";

const mocks = vi.hoisted(() => ({
  recordCalendlyBooking: vi.fn(),
  createAdminClient: vi.fn(() => ({ fake: "client" })),
  signingKey: { value: undefined as string | undefined },
}));

vi.mock("@/lib/services/calendly-bookings", () => ({
  recordCalendlyBooking: mocks.recordCalendlyBooking,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/config", () => ({
  get config() {
    return { CALENDLY_WEBHOOK_SIGNING_KEY: mocks.signingKey.value };
  },
}));

const { POST } = await import("./route");

const validPayload = {
  event: "invitee.created",
  payload: {
    uri: "https://api.calendly.com/scheduled_events/abc/invitees/123",
    name: "Jane Applicant",
    email: "jane@example.com",
    scheduled_event: {
      uri: "https://api.calendly.com/scheduled_events/abc",
      name: "Discovery Call",
      start_time: "2026-08-01T15:00:00.000000Z",
      end_time: "2026-08-01T15:30:00.000000Z",
    },
  },
};

function signedRequest(
  body: string,
  {
    key = SIGNING_KEY,
    timestampSeconds = Math.floor(Date.now() / 1000),
    header,
  }: { key?: string; timestampSeconds?: number; header?: string | null } = {},
) {
  const signature = createHmac("sha256", key)
    .update(`${timestampSeconds}.${body}`)
    .digest("hex");
  const headers = new Headers({ "content-type": "application/json" });
  const value =
    header === undefined ? `t=${timestampSeconds},v1=${signature}` : header;
  if (value !== null) headers.set("calendly-webhook-signature", value);

  return new Request("https://www.vendingpreneurs.com/api/webhooks/calendly", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/webhooks/calendly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signingKey.value = SIGNING_KEY;
    mocks.recordCalendlyBooking.mockResolvedValue(undefined);
  });

  it("records the booking for a correctly signed event", async () => {
    const body = JSON.stringify(validPayload);

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(mocks.recordCalendlyBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventKind: "invitee.created",
        inviteeEmail: "jane@example.com",
      }),
    );
  });

  it("rejects an unsigned request without touching the database", async () => {
    // The signature is the only authentication on this endpoint.
    const body = JSON.stringify(validPayload);

    const response = await POST(signedRequest(body, { header: null }));

    expect(response.status).toBe(401);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong key", async () => {
    const body = JSON.stringify(validPayload);

    const response = await POST(signedRequest(body, { key: "whsec_wrong" }));

    expect(response.status).toBe(401);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("rejects a body altered after signing", async () => {
    const signed = JSON.stringify(validPayload);
    const tampered = JSON.stringify({
      ...validPayload,
      event: "invitee.canceled",
    });
    const request = signedRequest(signed);
    const forged = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: tampered,
    });

    const response = await POST(forged);

    expect(response.status).toBe(401);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("rejects a replayed old delivery", async () => {
    const body = JSON.stringify(validPayload);
    const anHourAgo = Math.floor(Date.now() / 1000) - 60 * 60;

    const response = await POST(
      signedRequest(body, { timestampSeconds: anHourAgo }),
    );

    expect(response.status).toBe(401);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("fails closed when no signing key is configured", async () => {
    // Without this the endpoint would accept anything the moment the env var
    // went missing.
    mocks.signingKey.value = undefined;
    const body = JSON.stringify(validPayload);

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(401);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("returns 400 for a correctly signed but unrecognizable payload", async () => {
    const body = JSON.stringify({ event: "something.else", payload: {} });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(400);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("returns 400 for a correctly signed body that is not JSON", async () => {
    const response = await POST(signedRequest("not json at all"));

    expect(response.status).toBe(400);
    expect(mocks.recordCalendlyBooking).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking internals when recording throws", async () => {
    mocks.recordCalendlyBooking.mockRejectedValue(
      new Error("connection to db-primary-7 refused"),
    );
    const body = JSON.stringify(validPayload);

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
