import { describe, expect, it, vi } from "vitest";
import {
  CalendlyApiError,
  CalendlyConfigError,
  createCalendlyApiClient,
} from "./calendly-api";

function jsonResponse(
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("createCalendlyApiClient", () => {
  it("throws CalendlyConfigError when no token is given", () => {
    expect(() => createCalendlyApiClient({})).toThrow(CalendlyConfigError);
  });

  it("resolves the current organization uri from /users/me", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          resource: {
            current_organization:
              "https://api.calendly.com/organizations/org-1",
          },
        }),
    );

    const client = createCalendlyApiClient({
      token: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const uri = await client.getCurrentOrganizationUri();

    expect(uri).toBe("https://api.calendly.com/organizations/org-1");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.calendly.com/users/me");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok",
    });
  });

  it("paginates scheduled events across two pages by following next_page", async () => {
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(
        jsonResponse({
          collection: [
            {
              uri: "https://api.calendly.com/scheduled_events/e1",
              name: "Call",
              start_time: "2026-01-01T00:00:00Z",
              end_time: "2026-01-01T00:30:00Z",
              status: "active",
            },
          ],
          pagination: {
            next_page:
              "https://api.calendly.com/scheduled_events?page_token=page-2",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          collection: [
            {
              uri: "https://api.calendly.com/scheduled_events/e2",
              name: "Call",
              start_time: "2026-01-02T00:00:00Z",
              end_time: "2026-01-02T00:30:00Z",
              status: "active",
            },
          ],
          pagination: { next_page: null },
        }),
      );

    const client = createCalendlyApiClient({
      token: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events = await client.listScheduledEvents({
      organizationUri: "https://api.calendly.com/organizations/org-1",
      minStartTime: "2026-01-01T00:00:00Z",
      maxStartTime: "2026-02-01T00:00:00Z",
    });

    expect(events.map((event) => event.uri)).toEqual([
      "https://api.calendly.com/scheduled_events/e1",
      "https://api.calendly.com/scheduled_events/e2",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0] as string).toContain("page_token=page-2");
  });

  it("paginates invitees for one event", async () => {
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(
        jsonResponse({
          collection: [
            {
              uri: "inv-1",
              email: "a@example.com",
              name: "A",
              status: "active",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          pagination: {
            next_page:
              "https://api.calendly.com/scheduled_events/e1/invitees?page_token=next",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          collection: [
            {
              uri: "inv-2",
              email: "b@example.com",
              name: "B",
              status: "active",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          pagination: { next_page: null },
        }),
      );

    const client = createCalendlyApiClient({
      token: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const invitees = await client.listEventInvitees(
      "https://api.calendly.com/scheduled_events/e1",
    );

    expect(invitees.map((invitee) => invitee.uri)).toEqual(["inv-1", "inv-2"]);
  });

  it("retries once on a 429 then succeeds", async () => {
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429, headers: {} }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ resource: { current_organization: "org" } }),
      );

    const client = createCalendlyApiClient({
      token: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const uri = await client.getCurrentOrganizationUri();

    expect(uri).toBe("org");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws a typed error and never leaks the token in the message", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("token tok-secret-value leaked in the body", {
          status: 500,
        }),
    );

    const client = createCalendlyApiClient({
      token: "tok-secret-value",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    let caught: unknown;
    try {
      await client.getCurrentOrganizationUri();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CalendlyApiError);
    expect((caught as Error).message).not.toContain("tok-secret-value");
    expect((caught as Error).message).toContain("[redacted]");
  });
});

describe("organization resolution", () => {
  // A prior Vendingpreneurs PAT shipped without users:read, which would have
  // failed the sweep on its very first request.
  it("falls back to organization_memberships when /users/me is forbidden", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/users/me")) {
        return new Response(JSON.stringify({ message: "forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/organization_memberships")) {
        return new Response(
          JSON.stringify({
            collection: [
              { organization: "https://api.calendly.com/organizations/org-9" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error("unexpected url " + url);
    });

    const client = createCalendlyApiClient({ token: "tok", fetchImpl });
    await expect(client.getCurrentOrganizationUri()).resolves.toBe(
      "https://api.calendly.com/organizations/org-9",
    );
  });

  it("still prefers /users/me when the token can read it", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            resource: {
              current_organization:
                "https://api.calendly.com/organizations/org-1",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = createCalendlyApiClient({ token: "tok", fetchImpl });
    await expect(client.getCurrentOrganizationUri()).resolves.toContain(
      "org-1",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
