import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  checkPublicRateLimit: vi.fn(),
  recordPopupEvent: vi.fn(),
  recordTaggedPageView: vi.fn(),
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

vi.mock("@/lib/services/popups", () => ({
  recordPopupEvent: mocks.recordPopupEvent,
}));

vi.mock("@/lib/services/lead-page-views", () => ({
  recordTaggedPageView: mocks.recordTaggedPageView,
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
    // Reset, not just re-stub: the call list is what the budget-scoping tests
    // below assert on, and a hoisted vi.fn keeps it across tests otherwise.
    mocks.checkPublicRateLimit.mockReset();
    mocks.checkPublicRateLimit.mockResolvedValue(true);
    mocks.recordPopupEvent.mockReset();
    mocks.recordPopupEvent.mockResolvedValue(true);
    mocks.recordTaggedPageView.mockReset();
    mocks.recordTaggedPageView.mockResolvedValue(true);
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

  it("accepts popup event types and forwards the popup id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const response = await POST(
      eventRequest({
        body: {
          ...payload,
          event_type: "popup_shown",
          external_id: "vending-website:popup_shown:vp-session-1:123",
          properties: { popup_id: "exit-apply", popup_trigger: "EXIT_INTENT" },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        event_type: "popup_shown",
        properties: expect.objectContaining({ popup_id: "exit-apply" }),
      }),
    );
    // Popup events are also counted locally for the admin stat tiles.
    expect(mocks.recordPopupEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "popup_shown",
        popupId: "exit-apply",
      }),
    );
  });

  it("does not write popup counters for non-popup events", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await POST(eventRequest());

    expect(mocks.recordPopupEvent).not.toHaveBeenCalled();
  });

  it("rejects unknown event types", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      eventRequest({ body: { ...payload, event_type: "made_up_event" } }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
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

  /**
   * The fail-closed rule belongs to the landing-view write, which is the only
   * thing on this route that writes a row of ours. Scoping it to the whole
   * action instead 429s the money-page forward and the popup counter too --
   * both of which run before the write and neither of which is the thing a
   * refusal was meant to protect.
   */
  it("counts the landing-view write on its own budget, not the event gate's", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await POST(eventRequest());

    const actions = mocks.checkPublicRateLimit.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(actions).toEqual(["attribution_event", "page_view"]);
  });

  it("still forwards the event when only the page-view budget refuses", async () => {
    mocks.checkPublicRateLimit.mockImplementation(
      async (action: string) => action !== "page_view",
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const response = await POST(eventRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.recordTaggedPageView).not.toHaveBeenCalled();
  });

  it("does not spend the page-view budget on an event that writes no view", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await POST(
      eventRequest({
        body: { ...payload, event_type: "popup_shown" },
      }),
    );

    const actions = mocks.checkPublicRateLimit.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(actions).toEqual(["attribution_event"]);
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
  body = payload,
}: {
  cookie?: string;
  origin?: string;
  fetchSite?: string;
  body?: Record<string, unknown>;
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
      body: JSON.stringify(body),
    },
  );
}
