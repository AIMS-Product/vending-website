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
  async function request<T>(
    path: string,
    init: { method?: "GET" | "POST"; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
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

    /**
     * Mint a short link for a URL the link builder just produced.
     *
     * The one write this client makes, and it is to our own Bitly account,
     * never to a partner system. `group_guid` is optional on Bitly's side (it
     * falls back to the token's default group), so a missing env var still
     * produces a link; it just lands in the default group.
     */
    async createBitlink({
      longUrl,
      groupGuid,
      title,
    }: {
      longUrl: string;
      groupGuid?: string | null;
      title?: string | null;
    }): Promise<BitlyLink & { link: string }> {
      const body = await request<{
        id?: string | null;
        link?: string | null;
        long_url?: string | null;
        title?: string | null;
      }>("/bitlinks", {
        method: "POST",
        body: {
          long_url: longUrl,
          ...(groupGuid ? { group_guid: groupGuid } : {}),
          ...(title ? { title } : {}),
        },
      });
      if (!body.id || !body.link) {
        throw new BitlyApiError(502, "Bitly returned no link id.");
      }
      return {
        id: body.id,
        link: body.link,
        longUrl: body.long_url ?? longUrl,
        title: body.title?.trim() || null,
      };
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
      }>(
        `/bitlinks/${encodeURIComponent(bitlinkId)}/clicks?${params.toString()}`,
      );

      return (body.link_clicks ?? []).flatMap((entry) => {
        const date = normalizeDay(entry?.date);
        if (!date) return [];
        return [{ date, clicks: Math.max(0, Math.trunc(entry?.clicks ?? 0)) }];
      });
    },
  };
}

export type BitlyClient = ReturnType<typeof createBitlyClient>;

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
