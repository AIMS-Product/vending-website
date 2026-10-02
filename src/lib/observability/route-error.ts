import * as Sentry from "@sentry/nextjs";

/**
 * Sentry reporting for API routes that catch an error, log it and answer a
 * generic 500. Those errors never reach Sentry's request-error hook because
 * the route handled them. Never throws, never changes the response.
 *
 * The original message is NOT sent: upstream and database messages can carry
 * contact details, request URLs or credential fragments, and the repo is held
 * to a no-PII bar. Sentry gets the error class, the route name and stack
 * frames; the message stays in the Vercel log line each route already writes.
 */

const FLUSH_TIMEOUT_MS = 2000;

/**
 * A copy of `error` with the message removed: same class name, stack frames
 * only (the first stack line repeats the message, so every non-frame line is
 * dropped). `label` names the caller, for example `cron ga4-sync`.
 */
export function messageFreeError(label: string, error: unknown): Error {
  const name = error instanceof Error ? error.name : "UnknownError";
  const safe = new Error(`${label} threw ${name}`);
  safe.name = name;
  if (error instanceof Error && error.stack) {
    const frames = error.stack
      .split("\n")
      .filter((line) => line.trimStart().startsWith("at "));
    safe.stack = [`${name}: ${safe.message}`, ...frames].join("\n");
  }
  return safe;
}

/** Report an error an API route caught. `route` is a stable name, not a URL. */
export async function reportRouteError(
  route: string,
  error: unknown,
): Promise<void> {
  try {
    Sentry.captureException(messageFreeError(`route ${route}`, error), {
      level: "error",
      tags: { route },
      fingerprint: ["route-error", route],
    });
    await Sentry.flush(FLUSH_TIMEOUT_MS);
  } catch (reportError) {
    console.warn("route error report failed", {
      route,
      name: reportError instanceof Error ? reportError.name : "UnknownError",
    });
  }
}
