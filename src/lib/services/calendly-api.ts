import "server-only";

/**
 * Thin read-only Calendly REST client used by the booking reconciliation
 * sweep (src/lib/chatbot/booking-reconcile.ts). Mirrors the house pattern in
 * src/lib/close/client.ts: typed errors, a sanitized error message that never
 * leaks the token, and a bounded retry on 429.
 */

export class CalendlyApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CalendlyApiError";
    this.status = status;
  }
}

export class CalendlyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendlyConfigError";
  }
}

export type CalendlyTracking = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  salesforce_uuid?: string | null;
};

export type CalendlyInvitee = {
  uri: string;
  email: string | null;
  name: string | null;
  status: string;
  created_at: string;
  /** Absolute URI of the scheduled event this invitee belongs to. */
  event?: string | null;
  tracking?: CalendlyTracking | null;
};

export type CalendlyScheduledEvent = {
  uri: string;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  /** The host(s) Calendly assigned; on a round-robin this is who takes the call. */
  event_memberships?: Array<{
    user_name?: string | null;
    user_email?: string | null;
  }> | null;
};

export type CalendlyApiClient = ReturnType<typeof createCalendlyApiClient>;

/** Hard cap on total HTTP calls in one sweep. A wide lookback window must not run away. */
/**
 * Default ceiling on HTTP calls per sweep. One request per scheduled event is
 * needed to read its invitees, and this org runs ~14 events a day across its
 * calendars, so a 30-day window is already ~450 calls. The daily cron keeps
 * this default; a one-off historical backfill raises it explicitly.
 */
const DEFAULT_MAX_REQUESTS_PER_SWEEP = 500;
/** Hard cap on pages walked per paginated list. Calendly's next_page_token is trusted, but bounded. */
const MAX_PAGES_PER_LIST = 50;
const MAX_ATTEMPTS_PER_REQUEST = 3;
const PAGE_SIZE = 100;

function sanitizeCalendlyErrorText(value: string, token?: string): string {
  let sanitized = value.replace(/\s+/g, " ").trim();
  if (token) sanitized = sanitized.split(token).join("[redacted]");
  return sanitized.slice(0, 240);
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Returns `absoluteUrl` only if it points at the same origin as the configured
 * base. Throws otherwise, so a malformed or hostile `uri` in an API response
 * cannot redirect an authenticated request off-host.
 */
function assertSameOrigin(absoluteUrl: string, baseUrl: string): string {
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(absoluteUrl);
    base = new URL(baseUrl);
  } catch {
    throw new CalendlyApiError(
      0,
      "Calendly returned an unusable resource URL.",
    );
  }
  if (parsed.origin !== base.origin) {
    throw new CalendlyApiError(
      0,
      "Calendly returned a resource URL on an unexpected host.",
    );
  }
  return parsed.toString();
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createCalendlyApiClient({
  token,
  baseUrl = "https://api.calendly.com",
  fetchImpl = fetch,
  maxRequests = DEFAULT_MAX_REQUESTS_PER_SWEEP,
}: {
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Raise only for a deliberate one-off historical backfill. */
  maxRequests?: number;
}) {
  if (!token) {
    throw new CalendlyConfigError("Calendly API token is not configured.");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  let requestCount = 0;

  async function request<T>(pathOrUrl: string): Promise<T> {
    requestCount += 1;
    if (requestCount > maxRequests) {
      throw new CalendlyApiError(0, "Calendly sweep exceeded its request cap.");
    }

    // listEventInvitees builds its path from a `uri` that came back in a
    // previous API response, so the absolute branch is reachable with
    // server-supplied data. Pin it to the configured host: this request
    // carries a bearer token, and sending that to whatever host a response
    // named would hand the credential away.
    const url = pathOrUrl.startsWith("http")
      ? assertSameOrigin(pathOrUrl, normalizedBaseUrl)
      : `${normalizedBaseUrl}${pathOrUrl}`;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_REQUEST; attempt++) {
      const response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429 && attempt < MAX_ATTEMPTS_PER_REQUEST) {
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : 500 * attempt;
        await delayMs(wait);
        continue;
      }

      if (!response.ok) {
        const text = await safeResponseText(response);
        const safeText = sanitizeCalendlyErrorText(text, token);
        throw new CalendlyApiError(
          response.status,
          `Calendly API request failed with ${response.status}${safeText ? `: ${safeText}` : ""}`,
        );
      }

      return (await response.json()) as T;
    }

    throw new CalendlyApiError(
      429,
      "Calendly API rate limit exceeded after retries.",
    );
  }

  return {
    /** Resolves the organization uri for the account that owns this token. Never hardcode an org id. */
    /**
     * Resolves the organization URI, tolerating a token without `users:read`.
     *
     * A previous Vendingpreneurs PAT was issued without that scope and
     * /users/me 401'd, which would fail this sweep on its very first request.
     * organization_memberships returns the same URI and sits under a different
     * scope, so it is the fallback rather than a second guess.
     */
    async getCurrentOrganizationUri(): Promise<string> {
      try {
        const data = await request<{
          resource: { current_organization: string };
        }>("/users/me");
        if (data.resource?.current_organization) {
          return data.resource.current_organization;
        }
      } catch (error) {
        if (!(error instanceof CalendlyApiError) || error.status < 400)
          throw error;
        console.warn("calendly: /users/me unavailable, trying memberships", {
          status: error.status,
        });
      }

      const memberships = await request<{
        collection?: Array<{ organization?: string }>;
      }>("/organization_memberships?count=1");
      const uri = memberships.collection?.[0]?.organization;
      if (!uri) {
        throw new CalendlyApiError(
          0,
          "Could not resolve the Calendly organization from this token.",
        );
      }
      return uri;
    },

    /** Lists active scheduled events in the window, paginating via next_page_token with a hard page cap. */
    async listScheduledEvents({
      organizationUri,
      minStartTime,
      maxStartTime,
    }: {
      organizationUri: string;
      minStartTime: string;
      maxStartTime: string;
    }): Promise<CalendlyScheduledEvent[]> {
      const events: CalendlyScheduledEvent[] = [];
      const params = new URLSearchParams({
        organization: organizationUri,
        min_start_time: minStartTime,
        max_start_time: maxStartTime,
        status: "active",
        count: String(PAGE_SIZE),
      });

      // Follow `pagination.next_page` rather than rebuilding the query with a
      // page_token. Calendly rejects a reconstructed request with
      // "page_token is invalid" (confirmed against the live API); the absolute
      // next_page URL it hands back is the supported way to page. request()
      // pins that URL to the configured origin before sending the token.
      let next: string | null = `/scheduled_events?${params.toString()}`;
      for (let page = 0; page < MAX_PAGES_PER_LIST && next; page++) {
        const data: {
          collection?: CalendlyScheduledEvent[];
          pagination?: { next_page?: string | null };
        } = await request(next);
        events.push(...(data.collection ?? []));
        next = data.pagination?.next_page ?? null;
      }

      return events;
    },

    /** Lists invitees for one scheduled event, paginating the same way. */
    async listEventInvitees(eventUri: string): Promise<CalendlyInvitee[]> {
      const invitees: CalendlyInvitee[] = [];
      let next: string | null = `${eventUri}/invitees?count=${PAGE_SIZE}`;

      for (let page = 0; page < MAX_PAGES_PER_LIST && next; page++) {
        const data: {
          collection?: CalendlyInvitee[];
          pagination?: { next_page?: string | null };
        } = await request(next);
        invitees.push(...(data.collection ?? []));
        next = data.pagination?.next_page ?? null;
      }

      return invitees;
    },

    /** One invitee by its absolute URI (from a webhook payload or the embed's postMessage). */
    async getInvitee(inviteeUri: string): Promise<CalendlyInvitee | null> {
      const data: { resource?: CalendlyInvitee } = await request(inviteeUri);
      return data.resource ?? null;
    },

    /** One scheduled event by its absolute URI. */
    async getScheduledEvent(
      eventUri: string,
    ): Promise<CalendlyScheduledEvent | null> {
      const data: { resource?: CalendlyScheduledEvent } =
        await request(eventUri);
      return data.resource ?? null;
    },

    /**
     * Open slots for one event type between two instants. Calendly caps the
     * range at 7 days per request, so callers wanting more call this in
     * windows. Returns start times as ISO strings.
     */
    async listAvailableTimes({
      eventTypeUri,
      startTime,
      endTime,
    }: {
      eventTypeUri: string;
      startTime: string;
      endTime: string;
    }): Promise<string[]> {
      const params = new URLSearchParams({
        event_type: eventTypeUri,
        start_time: startTime,
        end_time: endTime,
      });
      const data: {
        collection?: Array<{ start_time?: string; status?: string }>;
      } = await request(`/event_type_available_times?${params.toString()}`);
      return (data.collection ?? [])
        .filter((slot) => slot.status !== "unavailable" && slot.start_time)
        .map((slot) => slot.start_time as string);
    },
  };
}
