import * as Sentry from "@sentry/nextjs";
import { messageFreeError } from "@/lib/observability/route-error";

/**
 * Failure reporting for the /api/admin/<job>/run cron routes.
 *
 * Every runner catches its own errors and answers 500 with a generic body, so
 * nothing reaches Sentry's request-error hook (it only sees thrown errors) and
 * the only trace is a Vercel log line. These helpers make a failed run visible
 * where alerts live. They never throw and never change a route's response.
 *
 * PII and secrets: the original error message is NOT sent (see
 * `messageFreeError`). Upstream messages can carry contact details, request
 * URLs or fragments of a credential (the GA4 runner's comment calls this out).
 * The message stays in the Vercel log line each route already writes. Event
 * scrubbing (`sentryPiiHooks`) runs on top.
 * Callers must not pass lead or contact data in `detail`.
 */

const FLUSH_TIMEOUT_MS = 2000;

/** Serverless functions freeze after the response; push the event out first. */
async function flushQuietly(job: string) {
  try {
    await Sentry.flush(FLUSH_TIMEOUT_MS);
  } catch (flushError) {
    console.warn("cron failure report: sentry flush failed", {
      job,
      name: flushError instanceof Error ? flushError.name : "UnknownError",
    });
  }
}

/** Report an error thrown inside a cron run. Call from the route's catch. */
export async function reportCronException(
  job: string,
  error: unknown,
): Promise<void> {
  try {
    Sentry.captureException(messageFreeError(`cron ${job}`, error), {
      level: "error",
      tags: { cron: job, cron_failure: "exception" },
      // One issue per job, however the error text varies.
      fingerprint: ["cron-failure", job],
    });
  } catch (captureError) {
    console.warn("cron failure report: capture failed", {
      job,
      name: captureError instanceof Error ? captureError.name : "UnknownError",
    });
    return;
  }
  await flushQuietly(job);
}

/**
 * Report a run that finished but did not succeed: a connector recorded an
 * error, or a send failed, and the route answers non-2xx (or 200 with
 * `ok: false`) without throwing. `detail` must be a short, non-PII summary
 * such as connector names.
 */
export async function reportCronRunFailure(
  job: string,
  detail: string,
): Promise<void> {
  try {
    Sentry.captureMessage(`cron ${job} finished with a failure: ${detail}`, {
      level: "error",
      tags: { cron: job, cron_failure: "run" },
      fingerprint: ["cron-failure", job, "run"],
    });
  } catch (captureError) {
    console.warn("cron failure report: capture failed", {
      job,
      name: captureError instanceof Error ? captureError.name : "UnknownError",
    });
    return;
  }
  await flushQuietly(job);
}
