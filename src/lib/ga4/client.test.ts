import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { createGa4Client, parseServiceAccount } from "./client";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  project_id: "test-project",
  private_key: privateKey,
  client_email: "ga4-reader@test-project.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token",
});

function buildFetch(
  handlers: {
    token?: () => { status: number; body: unknown };
    report?: (body: unknown) => { status: number; body: unknown };
  } = {},
) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const isToken = url.includes("oauth2.googleapis.com");
      const parsed =
        isToken || typeof init?.body !== "string"
          ? init?.body
          : JSON.parse(init.body);
      calls.push({ url, body: parsed });

      const handled = isToken
        ? (handlers.token?.() ?? {
            status: 200,
            body: { access_token: "test-token", expires_in: 3599 },
          })
        : (handlers.report?.(parsed) ?? { status: 200, body: { rows: [] } });

      return {
        ok: handled.status >= 200 && handled.status < 300,
        status: handled.status,
        text: async () => JSON.stringify(handled.body),
      } as unknown as Response;
    },
  );
  return { fetchImpl, calls };
}

describe("parseServiceAccount", () => {
  it("reads the fields the JWT needs", () => {
    const sa = parseServiceAccount(SERVICE_ACCOUNT);
    expect(sa?.clientEmail).toBe(
      "ga4-reader@test-project.iam.gserviceaccount.com",
    );
    expect(sa?.tokenUri).toBe("https://oauth2.googleapis.com/token");
  });

  it("returns null rather than throwing on anything unusable", () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount("not json")).toBeNull();
    // A key with no private_key cannot sign, so it is not usable.
    expect(
      parseServiceAccount(JSON.stringify({ client_email: "a@b.com" })),
    ).toBeNull();
  });

  it("repairs the escaped newlines an env var round-trip leaves behind", () => {
    // Pasting a key into a dashboard turns real newlines into a literal \n.
    const escaped = SERVICE_ACCOUNT.replace(/\\n/g, "\\\\n");
    const sa = parseServiceAccount(escaped);
    expect(sa?.privateKey).toContain("-----BEGIN PRIVATE KEY-----\n");
    expect(sa?.privateKey).not.toContain("\\n");
  });
});

describe("createGa4Client", () => {
  it("signs a JWT, exchanges it, and calls runReport with a bearer token", async () => {
    const { fetchImpl, calls } = buildFetch({
      report: () => ({
        status: 200,
        body: {
          rows: [
            {
              dimensionValues: [
                { value: "20260901" },
                { value: "/booking-youtube" },
                { value: "youtube-home" },
                { value: "youtube" },
              ],
              metricValues: [
                { value: "403" },
                { value: "169" },
                { value: "150" },
                { value: "120" },
                { value: "4" },
                { value: "9123.5" },
              ],
            },
          ],
        },
      }),
    });

    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
    });

    const rows = await client.fetchPageViews({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });

    const [tokenCall, reportCall] = calls;
    expect(tokenCall.url).toBe("https://oauth2.googleapis.com/token");
    expect(reportCall.url).toContain("properties/526227693:runReport");
    expect((fetchImpl.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-token",
    });

    expect(rows).toEqual([
      {
        day: "2026-09-01",
        landingPage: "/booking-youtube",
        utmCampaign: "youtube-home",
        utmSource: "youtube",
        screenPageViews: 403,
        sessions: 169,
        engagedSessions: 150,
        newUsers: 120,
        keyEvents: 4,
        userEngagementSeconds: 9123.5,
      },
    ]);
  });

  it("reuses one access token across calls instead of re-signing every time", async () => {
    const { fetchImpl } = buildFetch();
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
    });

    await client.fetchPageViews({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });
    await client.fetchPageViews({
      startDate: "2026-09-02",
      endDate: "2026-09-02",
    });

    const tokenCalls = fetchImpl.mock.calls.filter((call) =>
      String(call[0]).includes("oauth2"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("pages until GA4 stops returning rows", async () => {
    let call = 0;
    const page = (offset: number) => ({
      dimensionValues: [
        { value: "20260901" },
        { value: `/p${offset}` },
        { value: "c" },
        { value: "youtube" },
      ],
      metricValues: Array.from({ length: 6 }, () => ({ value: "1" })),
    });
    const { fetchImpl } = buildFetch({
      report: (body) => {
        call += 1;
        const limit = Number((body as { limit: number }).limit);
        // Two full pages, then a short one that ends the loop.
        const rows =
          call <= 2
            ? Array.from({ length: limit }, (_, i) => page(i))
            : [page(999)];
        return { status: 200, body: { rows } };
      },
    });

    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
      pageSize: 2,
    });

    const rows = await client.fetchPageViews({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });

    expect(rows).toHaveLength(5);
    expect(call).toBe(3);
  });

  it("asks for a stable row order so offset paging cannot repeat or skip rows", async () => {
    const { fetchImpl, calls } = buildFetch();
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
    });

    await client.fetchPageViews({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });

    const body = calls[1].body as { orderBys: unknown[] };
    expect(body.orderBys).toHaveLength(4);
  });

  it("refuses a read whose rows do not add up to GA4's own total", async () => {
    const { fetchImpl } = buildFetch({
      report: () => ({
        status: 200,
        body: {
          rows: [
            {
              dimensionValues: [
                { value: "20260901" },
                { value: "/booking-youtube" },
                { value: "youtube-home" },
                { value: "youtube" },
              ],
              metricValues: Array.from({ length: 6 }, () => ({ value: "403" })),
            },
          ],
          // 97 views GA4 counted never arrived as rows.
          totals: [{ metricValues: [{ value: "500" }] }],
        },
      }),
    });
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
    });

    await expect(
      client.fetchPageViews({ startDate: "2026-09-01", endDate: "2026-09-01" }),
    ).rejects.toThrow(/refusing a partial read/);
  });

  it("throws with the API's status when the report fails", async () => {
    const { fetchImpl } = buildFetch({
      report: () => ({
        status: 403,
        body: {
          error: { message: "User does not have sufficient permissions" },
        },
      }),
    });
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
    });

    await expect(
      client.fetchPageViews({ startDate: "2026-09-01", endDate: "2026-09-01" }),
    ).rejects.toThrow(/403/);
  });

  it("never puts the private key or the access token in an error message", async () => {
    const { fetchImpl } = buildFetch({
      token: () => ({ status: 400, body: { error: "invalid_grant" } }),
    });
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "526227693",
      fetchImpl,
    });

    const error = await client
      .fetchPageViews({ startDate: "2026-09-01", endDate: "2026-09-01" })
      .catch((caught: unknown) => caught);

    const message = String(error);
    expect(message).not.toContain("BEGIN PRIVATE KEY");
    expect(message).not.toContain("test-token");
  });
});

describe("fetchChannelSessions", () => {
  it("asks for the link-standard dimensions plus the Ads campaign id and maps a row onto them", async () => {
    const { fetchImpl, calls } = buildFetch({
      report: () => ({
        status: 200,
        body: {
          rows: [
            {
              dimensionValues: [
                { value: "20260901" },
                { value: "instagram" },
                { value: "organic" },
                { value: "webinar-sept15" },
                { value: "reel-0911" },
                { value: "webinar-register" },
                { value: "(not set)" },
              ],
              metricValues: [{ value: "41" }],
            },
          ],
          totals: [{ metricValues: [{ value: "41" }] }],
        },
      }),
    });
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "123",
      fetchImpl,
    });

    const rows = await client.fetchChannelSessions({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });

    expect(rows).toEqual([
      {
        day: "2026-09-01",
        source: "instagram",
        medium: "organic",
        campaign: "webinar-sept15",
        content: "reel-0911",
        term: "webinar-register",
        campaignId: "(not set)",
        sessions: 41,
      },
    ]);
    const body = calls[1].body as {
      dimensions: Array<{ name: string }>;
      metrics: Array<{ name: string }>;
    };
    expect(body.dimensions.map((d) => d.name)).toEqual([
      "date",
      "sessionSource",
      "sessionMedium",
      "sessionCampaignName",
      "sessionManualAdContent",
      "sessionManualTerm",
      "sessionCampaignId",
    ]);
    expect(body.metrics.map((m) => m.name)).toEqual(["sessions"]);
  });

  it("keeps channel session rows even when they do not sum to GA4's total", async () => {
    const { fetchImpl } = buildFetch({
      report: () => ({
        status: 200,
        body: {
          rows: [
            {
              dimensionValues: Array.from({ length: 7 }, (_, i) => ({
                value: i === 0 ? "20260901" : "x",
              })),
              metricValues: [{ value: "5" }],
            },
          ],
          totals: [{ metricValues: [{ value: "9" }] }],
        },
      }),
    });
    const client = createGa4Client({
      serviceAccountJson: SERVICE_ACCOUNT,
      propertyId: "123",
      fetchImpl,
    });

    const rows = await client.fetchChannelSessions({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sessions).toBe(5);
  });
});
