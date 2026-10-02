/**
 * Abuse guards for the public signup action.
 *
 * The action is a server action anyone can POST to, and a signup subscribes
 * the address to the list with `status: 1`. Without a throttle a script can
 * list-bomb third-party addresses, which costs sender reputation and
 * ActiveCampaign contact billing.
 *
 * This limiter is per server instance (this app has no database), so it
 * slows a single client hard but is not a global cap across instances. Pair it
 * with a Vercel Firewall rate-limit rule on POST / for a hard ceiling.
 */

const SOURCE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const DEFAULT_SOURCE = "site";

/**
 * `source` arrives from a hidden form field, so it is client-controlled and
 * lands in an ActiveCampaign custom field. Accept only a short slug.
 */
export function sanitizeSource(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return DEFAULT_SOURCE;
  const candidate = raw.trim().toLowerCase();
  return SOURCE_PATTERN.test(candidate) ? candidate : DEFAULT_SOURCE;
}

/**
 * Best-effort client address. Vercel sets `x-forwarded-for` and puts the
 * client first. Returns null when nothing usable is present, so the caller
 * skips the per-IP check instead of putting every such request in one bucket.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}

export type RateLimiter = {
  /** Records one attempt for `key`. Returns false once the window is full. */
  take: (key: string, now?: number) => boolean;
};

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs, maxKeys = 5_000 } = options;
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    for (const [key, stamps] of hits) {
      const live = stamps.filter((stamp) => now - stamp < windowMs);
      if (live.length === 0) hits.delete(key);
      else hits.set(key, live);
    }
    // Still over budget after dropping expired keys: evict oldest first.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    take(key, now = Date.now()) {
      if (hits.size >= maxKeys && !hits.has(key)) prune(now);
      const live = (hits.get(key) ?? []).filter(
        (stamp) => now - stamp < windowMs,
      );
      if (live.length >= limit) {
        hits.set(key, live);
        return false;
      }
      hits.set(key, [...live, now]);
      return true;
    },
  };
}
