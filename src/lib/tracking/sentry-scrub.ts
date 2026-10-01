import type { Breadcrumb, Event } from "@sentry/nextjs";
import { PII_PARAMS } from "@/lib/content/masterclass";

/**
 * Query params that carry a person's details in a URL. PII_PARAMS covers the
 * registration links (and /playbook's `full_name`); `first` is the display
 * name on /masterclass-confirmed. Sentry records full URLs in breadcrumbs,
 * request data and spans, and `sendDefaultPii: false` does not strip query
 * strings, so every config runs its events through the hooks below.
 */
export const SENTRY_PII_PARAMS: readonly string[] = [...PII_PARAMS, "first"];

const FILTERED = "[Filtered]";

const PII_QUERY = new RegExp(
  `(^|[?&])(${SENTRY_PII_PARAMS.join("|")})=[^&#\\s]*`,
  "gi",
);

/**
 * Replaces the value of every PII param in a URL, query string or free text
 * (span descriptions like "GET /playbook?email=..."). Other params and the
 * rest of the string are left as they were.
 */
export function scrubUrl(value: string): string {
  return value.replace(PII_QUERY, `$1$2=${FILTERED}`);
}

const isPiiKey = (key: string) => SENTRY_PII_PARAMS.includes(key.toLowerCase());

function scrubValue(value: unknown): unknown {
  return typeof value === "string" ? scrubUrl(value) : value;
}

/** A copy of `data` with every string value scrubbed. */
function scrubData<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, scrubValue(value)]),
  ) as T;
}

type QueryString = NonNullable<Event["request"]>["query_string"];

function scrubQueryString(query: QueryString): QueryString {
  if (query === undefined || query === null) return query;
  if (typeof query === "string") return scrubUrl(query);
  if (Array.isArray(query)) {
    return query.map(([key, value]) =>
      isPiiKey(key) ? [key, FILTERED] : [key, value],
    ) as QueryString;
  }
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      isPiiKey(key) ? FILTERED : value,
    ]),
  );
}

/** Breadcrumb hook: fetch/xhr `url`, navigation `from`/`to`, and the message. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined && {
      message: scrubUrl(breadcrumb.message),
    }),
    ...(breadcrumb.data && { data: scrubData(breadcrumb.data) }),
  };
}

/**
 * Error and transaction hook: request URL and query string, the transaction
 * name, every span's description and data, and the trace context's data.
 * Returns a new event; the original is not mutated.
 */
export function scrubEvent<T extends Event>(event: T): T {
  const { request, spans, contexts, breadcrumbs } = event;
  const trace = contexts?.trace;
  return {
    ...event,
    ...(event.transaction !== undefined && {
      transaction: scrubUrl(event.transaction),
    }),
    ...(request && {
      request: {
        ...request,
        ...(request.url !== undefined && { url: scrubUrl(request.url) }),
        ...(request.query_string !== undefined && {
          query_string: scrubQueryString(request.query_string),
        }),
        ...(request.headers && { headers: scrubData(request.headers) }),
      },
    }),
    ...(breadcrumbs && { breadcrumbs: breadcrumbs.map(scrubBreadcrumb) }),
    ...(spans && {
      spans: spans.map((span) => ({
        ...span,
        ...(span.description !== undefined && {
          description: scrubUrl(span.description),
        }),
        ...(span.data && { data: scrubData(span.data) }),
      })),
    }),
    ...(trace?.data && {
      contexts: {
        ...contexts,
        trace: { ...trace, data: scrubData(trace.data) },
      },
    }),
  };
}

/** The three hooks, spread into every Sentry.init call. */
export const sentryPiiHooks = {
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
};
