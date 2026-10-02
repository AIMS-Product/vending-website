/** Connector reads: a healthy upstream answers in seconds. */
export const CONNECTOR_TIMEOUT_MS = 30_000;
/** OpenAI Responses calls reason before they answer; matches DataForSEO's 90s. */
export const LLM_TIMEOUT_MS = 90_000;

/**
 * Raised when an upstream does not answer in time. Named `TimeoutError` so it
 * reads the same as the platform's own abort error in logs and run records.
 */
export class FetchTimeoutError extends Error {
  constructor(
    readonly label: string,
    readonly timeoutMs: number,
  ) {
    super(
      `${label} timed out after ${
        timeoutMs >= 1000
          ? `${Math.round(timeoutMs / 1000)}s`
          : `${timeoutMs}ms`
      }.`,
    );
    this.name = "TimeoutError";
  }
}

function isAbortTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  );
}

/**
 * `fetch` with a deadline. Without one, a hung upstream holds the request
 * until the platform kills the function, and a sync that never returns never
 * writes its run record, so the failure leaves no trace at all.
 *
 * A timeout becomes a `FetchTimeoutError` naming the source, or whatever
 * `onTimeout` builds from it so a client can raise its own typed error.
 * Any other failure is rethrown untouched.
 */
export async function fetchWithTimeout(
  fetchImpl: (input: string | URL, init?: RequestInit) => Promise<Response>,
  input: string | URL,
  init: RequestInit,
  options: {
    label: string;
    timeoutMs?: number;
    onTimeout?: (error: FetchTimeoutError) => Error;
  },
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? CONNECTOR_TIMEOUT_MS;
  try {
    return await fetchImpl(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (!isAbortTimeout(error)) throw error;
    const timeout = new FetchTimeoutError(options.label, timeoutMs);
    throw options.onTimeout ? options.onTimeout(timeout) : timeout;
  }
}
