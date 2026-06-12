// Polls a freshly-published page URL until it responds, so the "Open live page"
// link is only shown once the route is actually live. Right after publish there
// is a short window where the route still 404s (revalidation/propagation), and
// surfacing the link during that window would hand the user a dead 404.

export type LivePollResult = "live" | "timed-out";

export type PollUntilLiveOptions = {
  // Injected for tests; defaults to global fetch in the browser.
  fetchImpl?: typeof fetch;
  // Injected for tests; defaults to setTimeout-based sleep.
  sleep?: (ms: number) => Promise<void>;
  // Backoff schedule in ms between attempts. The number of entries is the max
  // number of retries after the first immediate attempt.
  backoffMs?: number[];
  // Abort signal so a poll can be cancelled if the component unmounts.
  signal?: AbortSignal;
};

const DEFAULT_BACKOFF_MS = [500, 1000, 1500, 2000, 3000, 4000];

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function probe(
  url: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    // HEAD is enough to learn whether the route resolves; same-origin so no
    // CORS concerns. cache: "no-store" avoids a cached 404 masking a live page.
    const response = await fetchImpl(url, {
      method: "HEAD",
      cache: "no-store",
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pollUntilLive(
  url: string,
  options: PollUntilLiveOptions = {},
): Promise<LivePollResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  if (await probe(url, fetchImpl, options.signal)) return "live";

  for (const waitMs of backoff) {
    if (options.signal?.aborted) return "timed-out";
    await sleep(waitMs);
    if (options.signal?.aborted) return "timed-out";
    if (await probe(url, fetchImpl, options.signal)) return "live";
  }

  return "timed-out";
}
