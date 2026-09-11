import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  campaignFromLongUrl,
  createBitlyClient,
  isBitlinkId,
  type BitlyClient,
} from "@/lib/bitly/client";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Links pulled per run.
 *
 * Bitly has no batch clicks endpoint, so this is one HTTP request per link.
 * At 80 per run on an hourly cron the whole ~604-link library refreshes about
 * every eight hours, which is far more often than a daily marketing report
 * needs and keeps well clear of any per-hour API ceiling.
 *
 * ponytail: fixed batch size. If Bitly starts returning 429s, back this off or
 * read the documented rate limit from the response headers.
 */
const DEFAULT_BATCH_SIZE = 80;

/** Trailing window re-read per link. Upserts by day, so a re-read corrects. */
const DEFAULT_DAYS = 30;

/** Bitly reads in flight at once. Deliberately modest — see the batch note. */
const CONCURRENCY = 4;

export type BitlyClickSyncResult = {
  scanned: number;
  updated: number;
  daysWritten: number;
  /** Links the next run should retry: unreachable, or a write that errored. */
  failed: number;
  /**
   * Links whose stored id can never be requested, counted apart from `failed`.
   *
   * The runner turns `failed` into a 500, and a malformed id fails identically
   * on every run — so counting it there paged the cron nightly for a data
   * problem no retry can fix. It is a number to read in the response and a
   * warning in the log instead.
   */
  invalid: number;
  /** Links whose bitlink id was filled in from the Bitly group listing. */
  linksMapped: number;
};

type VideoRow = {
  utm_campaign: string;
  bitly_id: string | null;
};

/**
 * Pulls daily click counts for the tracked YouTube short links.
 *
 * Reads Bitly, writes only our own tables. Two jobs in one pass:
 *
 *  1. `mapMissingLinks` fills in `bitly_id` for registry rows that never got a
 *     short URL, by matching Bitly's own `long_url` UTMs against the campaign.
 *     That means a link created in Bitly after the spreadsheet export still
 *     gets picked up without anyone re-exporting anything.
 *  2. The batch claim reads the least-recently-synced links and upserts their
 *     trailing 30 days.
 *
 * A missing token makes this a no-op rather than an error: the tab is designed
 * to report clicks as "not connected" until someone supplies one.
 */
export async function syncBitlyClicks(
  deps: {
    client?: SyncClient;
    bitlyClient?: BitlyClient;
    batchSize?: number;
    days?: number;
    now?: Date;
  } = {},
): Promise<BitlyClickSyncResult> {
  const empty: BitlyClickSyncResult = {
    scanned: 0,
    updated: 0,
    daysWritten: 0,
    failed: 0,
    invalid: 0,
    linksMapped: 0,
  };

  if (!config.BITLY_ACCESS_TOKEN) return empty;

  const client = deps.client ?? createAdminClient();
  const bitly =
    deps.bitlyClient ??
    createBitlyClient({ accessToken: config.BITLY_ACCESS_TOKEN });
  const now = deps.now ?? new Date();
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const days = deps.days ?? DEFAULT_DAYS;

  const linksMapped = config.BITLY_GROUP_GUID
    ? await mapMissingLinks(client, bitly, config.BITLY_GROUP_GUID)
    : 0;

  const rows = await claimBatch(client, batchSize);
  if (rows.length === 0) return { ...empty, linksMapped };

  const result: BitlyClickSyncResult = {
    ...empty,
    linksMapped,
    scanned: rows.length,
  };
  const syncedAt = now.toISOString();
  let cursor = 0;

  async function worker() {
    for (;;) {
      const row = rows[cursor++];
      // Only an exhausted queue ends this worker. A row with no id is one row
      // to skip -- returning on it abandoned the rest of this worker's share.
      if (!row) return;
      if (!row.bitly_id) continue;

      // Refused before the request, and not retried: an id this shape can
      // never become valid, so it is stamped like a link with no clicks and
      // leaves the front of the claim queue rather than blocking it every run.
      if (!isBitlinkId(row.bitly_id)) {
        result.invalid += 1;
        console.warn("bitly click sync: stored bitlink id is unusable", {
          campaign: row.utm_campaign,
          bitlyId: row.bitly_id,
        });
        await stamp(row.utm_campaign);
        continue;
      }

      try {
        const series = await bitly.dailyClicks(row.bitly_id, { days });

        if (series.length > 0) {
          const { error } = await client.from("bitly_link_clicks").upsert(
            series.map((entry) => ({
              bitly_id: row.bitly_id as string,
              day: entry.date,
              clicks: entry.clicks,
              utm_campaign: row.utm_campaign,
              synced_at: syncedAt,
            })),
            { onConflict: "bitly_id,day" },
          );
          if (error) {
            result.failed += 1;
            continue;
          }
          result.daysWritten += series.length;
        }

        // Stamped even when the series was empty, so a link with genuinely no
        // clicks does not sit at the front of the queue forever.
        await stamp(row.utm_campaign);

        result.updated += 1;
      } catch (error) {
        // One unreachable link must not abort the batch. The row keeps its old
        // clicks_synced_at and is retried on the next run -- but it is logged,
        // because a link failing silently every run is how the clicks table
        // could sit empty with nobody noticing. No token in the message.
        result.failed += 1;
        console.warn("bitly click sync: link failed, will retry next run", {
          campaign: row.utm_campaign,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    }
  }

  async function stamp(campaign: string) {
    await client
      .from("youtube_videos")
      .update({ clicks_synced_at: syncedAt })
      .eq("utm_campaign", campaign);
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker),
  );

  return result;
}

/**
 * Fills in `bitly_id` for registry rows that have none, using Bitly's own
 * listing.
 *
 * Matching is on the `utm_campaign` in the link's long URL — an exact key both
 * sides already agree on, not a title or slug similarity guess.
 */
async function mapMissingLinks(
  client: SyncClient,
  bitly: BitlyClient,
  groupGuid: string,
): Promise<number> {
  const { data, error } = await client
    .from("youtube_videos")
    .select("utm_campaign,bitly_id")
    .is("bitly_id", null);

  if (error) return 0;
  const missing = (data ?? []) as VideoRow[];
  if (missing.length === 0) return 0;

  let links;
  try {
    links = await bitly.listGroupLinks(groupGuid);
  } catch {
    return 0;
  }

  const byCampaign = new Map<string, string>();
  for (const link of links) {
    const campaign = campaignFromLongUrl(link.longUrl);
    // First link wins: a campaign with two short links is a registry problem,
    // and silently preferring the later one would make the number move around.
    if (campaign && !byCampaign.has(campaign))
      byCampaign.set(campaign, link.id);
  }

  let mapped = 0;
  for (const row of missing) {
    const bitlyId = byCampaign.get(row.utm_campaign);
    if (!bitlyId) continue;
    const { error: updateError } = await client
      .from("youtube_videos")
      .update({ bitly_id: bitlyId, bitly_url: `https://${bitlyId}` })
      .eq("utm_campaign", row.utm_campaign);
    if (!updateError) mapped += 1;
  }

  return mapped;
}

/** Never-synced links first, then the stalest. Mirrors the Close reconciler. */
async function claimBatch(
  client: SyncClient,
  batchSize: number,
): Promise<VideoRow[]> {
  const { data, error } = await client
    .from("youtube_videos")
    .select("utm_campaign,bitly_id")
    .not("bitly_id", "is", null)
    .order("clicks_synced_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) return [];
  return (data ?? []) as VideoRow[];
}
