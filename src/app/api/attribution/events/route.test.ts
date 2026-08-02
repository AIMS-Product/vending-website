import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  checkPublicRateLimit: vi.fn(),
  config: {
    MONEY_PAGE_INGEST_URL: "https://money-page.test/api/ingest/vendingpreneurs",
    MONEY_PAGE_SECRET: "shared-secret",
  } as {
    MONEY_PAGE_INGEST_URL?: string;
    MONEY_PAGE_SECRET?: string;
  },
}));

vi.mock("@/lib/config", () => ({
  config: mocks.config,
}));

vi.mock("@/lib/public-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/public-rate-limit")
  >("@/lib/public-rate-limit");
  return { ...actual, checkPublicRateLimit: mocks.checkPublicRateLimit };
});

const payload = {
  event_type: "landing_viewed",
  external_id: "vending-website:landing_viewed:vp-session-1:123",
  occurred_at: "2026-06-26T01:00:00.000Z",
  vp_session_id: "vp-session-1",
  properties: {
    vp_session_id: "vp-session-1",
    landing_path: "/resources/start-vending",
    paid_platform: "meta_ads",
    campaign_id: "camp-123",
    adset_id: "set-123",
    ad_id: "ad-123",
    fbclid: "fbclid-123",
  },
} as const;

describe("attribution event route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.checkPublicRateLimit.mockResolvedValue(true);
    mocks.config.MONEY_PAGE_INGEST_URL =
      "https://money-page.test/api/ingest/vendingpreneurs";
    mocks.config.MONEY_PAGE_SECRET = "shared-secret";
  });

  it("forwards first-party browser events with the matching session cookie", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const response = await POST(eventRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, delivered: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://money-page.test/api/ingest/vendingpreneurs",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "shared-secret",
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        event_type: "landing_viewed",
        external_id: "vending-website:landing_viewed:vp-session-1:123",
        channel: "meta_ads",
        properties: expect.objectContaining({
          vp_session_id: "vp-session-1",
          ad_id: "ad-123",
        }),
      }),
    );
  });

  it("rejects events without the matching first-party session cookie", async () => {
    await expectUnauthorizedEvent(eventRequest({ cookie: "vp_sid=other" }));
  });

  it("rejects cross-site event posts even with a matching cookie", async () => {
    await expectUnauthorizedEvent(
      eventRequest({
        origin: "https://attacker.test",
        fetchSite: "cross-site",
      }),
    );
  });

  it("stops relaying to the downstream ingest once the caller is rate limited", async () => {
    // The cookie check is CSRF-grade, so a scripted caller can pass it. The
    // limit is what stops it spending our ingest secret in a loop.
    mocks.checkPublicRateLimit.mockResolvedValue(false);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(eventRequest());

    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function expectUnauthorizedEvent(request: Request) {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(401);
  expect(body).toEqual({ ok: false, message: "Unauthorized event." });
  expect(fetchMock).not.toHaveBeenCalled();
}

function eventRequest({
  cookie = "vp_sid=vp-session-1",
  origin = "https://vending-website.vercel.app",
  fetchSite = "same-origin",
}: {
  cookie?: string;
  origin?: string;
  fetchSite?: string;
} = {}) {
  return new Request(
    "https://vending-website.vercel.app/api/attribution/events",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin,
        "sec-fetch-site": fetchSite,
      },
      body: JSON.stringify(payload),
    },
  );
}
