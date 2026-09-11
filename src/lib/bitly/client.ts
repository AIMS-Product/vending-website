import "server-only";

/**
 * Minimal Bitly v4 client — only the two reads the click sync needs.
 *
 * Endpoint and response shapes verified against dev.bitly.com on 2026-09-10:
 * the clicks time series comes back as `link_clicks: [{ date, clicks }]`, and
 * the group listing as `links: [{ id, long_url, ... }]` with a
 * `pagination.search_after` cursor.
 *
 * There is no batch clicks endpoint, so click counts cost one request per
 * link — which is why the sync claims a batch of least-recently-synced links
 * rather than sweeping all ~604 every run.
 */

const DEFAULT_BASE_URL = "https://api-ssl.bitly.com/v4";

export class BitlyApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BitlyApiError";
    this.status = status;
  }
}

export type BitlyLink = {
  /** Host + back-half, e.g. "booking.vendingpreneurs.com/yt-desc-link-1-foo". */
  id: string;
  longUrl: string;
  title: string | null;
};

export type BitlyDailyClicks = {
  date: string;
  clicks: number;
};

export function createBitlyClient({
  accessToken,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
}: {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  async function request<T>(path: string): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Body text is kept short: Bitly echoes the request, and the whole thing
      // ends up in logs.
      const body = (await response.text().catch(() => "")).slice(0, 200);
      throw new BitlyApiError(
        response.status,
        `Bitly ${response.status} for ${path}: ${body}`,
      );
    }
    return (await response.json()) as T;
  }

  return {
    /**
     * Every link in a group, one page at a time.
     *
     * The long URL is what makes this useful: it carries the UTMs, so the
     * bitlink-to-campaign mapping comes from Bitly itself and does not have to
     * be re-keyed from the spreadsheet.
     */
    async listGroupLinks(
      groupGuid: string,
      { size = 100, maxPages = 20 } = {},
    ): Promise<BitlyLink[]> {
      const links: BitlyLink[] = [];
      let searchAfter: string | undefined;

      for (let page = 0; page < maxPages; page += 1) {
        const params = new URLSearchParams({ size: String(size) });
        if (searchAfter) params.set("search_after", searchAfter);

        const body = await request<{
          links?: Array<{
            id?: string | null;
            long_url?: string | null;
            title?: string | null;
          }> | null;
          pagination?: { search_after?: string | null } | null;
        }>(
          `/groups/${encodeURIComponent(groupGuid)}/bitlinks?${params.toString()}`,
        );

        for (const link of body.links ?? []) {
          if (!link?.id || !link.long_url) continue;
          links.push({
            id: link.id,
            longUrl: link.long_url,
            title: link.title?.trim() || null,
          });
        }

        searchAfter = body.pagination?.search_after || undefined;
        if (!searchAfter) break;
      }

      return links;
    },

    /** Daily clicks for one link over the trailing `days`. */
    async dailyClicks(
      bitlinkId: string,
      { days = 30 } = {},
    ): Promise<BitlyDailyClicks[]> {
      const params = new URLSearchParams({
        unit: "day",
        units: String(days),
      });
      const body = await request<{
        link_clicks?: Array<{
          date?: string | null;
          clicks?: number | null;
        }> | null;
      }>(`/bitlinks/${bitlinkPath(bitlinkId)}/clicks?${params.toString()}`);

      return (body.link_clicks ?? []).flatMap((entry) => {
        const date = normalizeDay(entry?.date);
        if (!date) return [];
        return [{ date, clicks: Math.max(0, Math.trunc(entry?.clicks ?? 0)) }];
      });
    },
  };
}

export type BitlyClient = ReturnType<typeof createBitlyClient>;

/**
 * A Bitlink id is "the domain and hash" — Bitly's own example request is
 * `/v4/bitlinks/bit.ly/12a4b6c/clicks`, with a literal slash. Percent-encoding
 * that slash addresses a different resource and 404s, so the value cannot
 * simply be wrapped in `encodeURIComponent`.
 *
 * It is validated instead, then encoded per segment — which is a no-op for
 * every character the pattern allows, and exists so nothing that slipped past
 * the pattern could still steer the path. These ids come from our own
 * `youtube_videos` rows, so anything off-pattern is a data problem rather than
 * a request to service, and it is refused before the fetch.
 *
 * The two halves are checked separately, because one permissive character class
 * over the whole thing let `..` through as a domain: `"../users"` has exactly
 * one slash, so it read as "domain/hash" and the path folded to
 * `/v4/users/clicks` — a different endpoint, reached carrying our bearer token.
 * The domain half now has to look like a hostname, so every label starts and
 * ends on an alphanumeric and no label can be empty or a dot.
 */
const BITLINK_DOMAIN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const BITLINK_HASH = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_DOMAIN_LENGTH = 80;

/**
 * Whether a stored id is safe to put in a request path.
 *
 * Exported so the click sync can tell a permanently malformed row from a link
 * that is merely unreachable today, and stop retrying the first kind forever.
 */
export function isBitlinkId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  if (parts.length !== 2) return false;
  const [domain, hash] = parts as [string, string];
  return (
    domain.length <= MAX_DOMAIN_LENGTH &&
    BITLINK_DOMAIN.test(domain) &&
    BITLINK_HASH.test(hash)
  );
}

export function bitlinkPath(bitlinkId: string): string {
  if (!isBitlinkId(bitlinkId)) {
    throw new BitlyApiError(
      400,
      `Refusing to request a bitlink that is not "domain/hash": ${JSON.stringify(bitlinkId)}`,
    );
  }
  return bitlinkId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/** Bitly returns an ISO timestamp; the clicks table is keyed by calendar day. */
function normalizeDay(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** `utm_campaign` off a Bitly long URL, so the mapping comes from the link. */
export function campaignFromLongUrl(longUrl: string): string | null {
  try {
    return new URL(longUrl).searchParams.get("utm_campaign")?.trim() || null;
  } catch {
    return null;
  }
}
