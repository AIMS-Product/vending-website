import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createBitlyClient, BitlyApiError } from "@/lib/bitly/client";
import { createGa4Client } from "@/lib/ga4/client";
import { createGhlClient, GhlApiError } from "@/lib/ghl/client";
import {
  createMetricoolClient,
  MetricoolApiError,
} from "@/lib/metricool/client";
import { createMetricoolTimelines } from "@/lib/metricool/timelines";
import { createSearchConsoleClient } from "@/lib/search-console/client";
import {
  createYouTubeAnalyticsClient,
  YouTubeAnalyticsError,
} from "@/lib/youtube-analytics/client";
import {
  CalendlyApiError,
  createCalendlyApiClient,
} from "@/lib/services/calendly-api";

/**
 * Every connector client bounds its requests with an abort signal, and a
 * deadline that fires surfaces as "<source> timed out" instead of a hang.
 *
 * The 30s deadline itself runs on the platform clock, so this stands in for
 * the signal firing: the fake fetch rejects the way undici does once the
 * signal it was handed aborts, and the test checks both halves of the
 * contract (a signal went out, and the timeout was named).
 */
function timingOutFetch() {
  const signals: Array<AbortSignal | null | undefined> = [];
  const fetchImpl = vi.fn(async (_input: unknown, init?: RequestInit) => {
    signals.push(init?.signal);
    throw new DOMException("The operation timed out.", "TimeoutError");
  }) as unknown as typeof fetch;
  return { fetchImpl, signals };
}

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SERVICE_ACCOUNT = JSON.stringify({
  private_key: privateKey,
  client_email: "reader@test-project.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token",
});

const RANGE = { blogId: "b1", from: "2026-09-01", to: "2026-09-02" };

describe("connector request deadlines", () => {
  it("Metricool brand summary", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createMetricoolClient({
      apiKey: "k",
      userId: "u",
      fetchImpl,
    });

    const failure = await client.fetchPosts(RANGE).catch((error) => error);

    expect(failure).toBeInstanceOf(MetricoolApiError);
    expect(failure.message).toBe("Metricool timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("Metricool timelines", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const timelines = createMetricoolTimelines({
      apiKey: "k",
      userId: "u",
      fetchImpl,
    });

    await expect(
      timelines.fetch({
        ...RANGE,
        network: "instagram",
        metric: "followers",
      }),
    ).rejects.toThrow("Metricool timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("Search Console token exchange", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createSearchConsoleClient({
      serviceAccountJson: SERVICE_ACCOUNT,
      siteUrl: "sc-domain:example.com",
      fetchImpl,
    });

    await expect(
      client.fetchDailyTotals({
        startDate: "2026-09-01",
        endDate: "2026-09-02",
      }),
    ).rejects.toThrow("Google token exchange timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("GA4 token exchange", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "123",
      fetchImpl,
    });

    await expect(
      client.fetchPageViews({ startDate: "2026-09-01", endDate: "2026-09-02" }),
    ).rejects.toThrow("Google token exchange timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("YouTube Analytics token refresh", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createYouTubeAnalyticsClient({
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
      fetchImpl,
    });

    const failure = await client.fetchVideoDay("2026-09-01").catch((e) => e);

    expect(failure).toBeInstanceOf(YouTubeAnalyticsError);
    expect(failure.message).toBe("YouTube token refresh timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("GoHighLevel", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createGhlClient({
      apiKey: "k",
      locationId: "loc",
      fetchImpl,
    });

    const failure = await client.listWorkflows().catch((error) => error);

    expect(failure).toBeInstanceOf(GhlApiError);
    expect(failure.message).toBe("GHL timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("Bitly", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createBitlyClient({
      accessToken: "t",
      baseUrl: "https://bitly.test/v4",
      fetchImpl,
    });

    const failure = await client.listGroupLinks("g1").catch((error) => error);

    expect(failure).toBeInstanceOf(BitlyApiError);
    expect(failure.message).toBe("Bitly timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("Calendly", async () => {
    const { fetchImpl, signals } = timingOutFetch();
    const client = createCalendlyApiClient({ token: "t", fetchImpl });

    const failure = await client
      .listEventInvitees("https://api.calendly.com/scheduled_events/e1")
      .catch((error) => error);

    expect(failure).toBeInstanceOf(CalendlyApiError);
    expect(failure.message).toBe("Calendly timed out after 30s.");
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });
});
