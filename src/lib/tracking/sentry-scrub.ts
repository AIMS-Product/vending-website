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

// Matches the plain form (`?email=a`) and the once-encoded form that appears
// when a URL is nested inside another param (`%3Femail%3Da`, `%26email%3Da`).
const PII_QUERY = new RegExp(
  `(^|[?&]|%3F|%26)(${SENTRY_PII_PARAMS.join("|")})(=|%3D)(?:(?!%26|%23)[^&#\\s])*`,
  "gi",
);

/**
 * Replaces the value of every PII param in a URL, query string or free text
 * (span descriptions like "GET /playbook?email=..."). Other params and the
 * rest of the string are left as they were.
 */
export function scrubUrl(value: string): string {
  return value.replace(PII_QUERY, `$1$2$3${FILTERED}`);
}

const isPiiKey = (key: string) => SENTRY_PII_PARAMS.includes(key.toLowerCase());

const MAX_DEPTH = 8;

/**
 * A copy of `value` with every string scrubbed, through arrays and plain
 * objects (depth-limited; anything deeper is dropped to a marker rather than
 * passed through unscrubbed). Never mutates its input.
 */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubUrl(value) as T;
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return FILTERED as T;
  if (Array.isArray(value)) {
    return value.map((item) => scrubDeep(item, depth + 1)) as T;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      scrubDeep(item, depth + 1),
    ]),
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
    ...(breadcrumb.data && { data: scrubDeep(breadcrumb.data) }),
  };
}

/**
 * Error and transaction hook. Scrubs every field a URL can reach: message,
 * logentry, exception values and frames, extra, tags, contexts, user, request
 * (url, query string, headers), breadcrumbs, spans and the transaction name.
 * Returns a new event; the original is not mutated.
 */
export function scrubEvent<T extends Event>(event: T): T {
  const { request, breadcrumbs, spans, exception } = event;
  const out: Record<string, unknown> = { ...(event as Event) };
  for (const key of [
    "transaction",
    "message",
    "logentry",
    "extra",
    "tags",
    "contexts",
    "user",
  ] as const) {
    if (event[key] !== undefined) out[key] = scrubDeep(event[key]);
  }
  if (exception) out.exception = scrubDeep(exception);
  if (request) {
    out.request = {
      ...scrubDeep(request),
      ...(request.query_string !== undefined && {
        query_string: scrubQueryString(request.query_string),
      }),
    };
  }
  if (breadcrumbs) out.breadcrumbs = breadcrumbs.map(scrubBreadcrumb);
  if (spans) out.spans = scrubDeep(spans);
  return out as T;
}

/** The three hooks, spread into every Sentry.init call. */
export const sentryPiiHooks = {
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
};
