import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  createYouTubeAnalyticsClient,
  type YouTubeAnalyticsClient,
  type YouTubeVideoDayRow,
} from "@/lib/youtube-analytics/client";
import {
  recordSyncRun,
  upsertChannelDaily,
  type ChannelDailyRow,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

export const YOUTUBE_ANALYTICS_CONNECTOR = "youtube-analytics";

/**
 * YouTube Analytics finalises a day two to three days late, so the run
 * re-reads a short trailing window ending yesterday. `days` widens it once
 * for a backfill: one request per day per 200 videos.
 */
const WINDOW_DAYS = 4;

export type YouTubeAnalyticsSyncResult = {
  endDate: string;
  connector: SyncRunOutcome;
};

export async function syncYouTubeAnalytics(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    youtube?: YouTubeAnalyticsClient | null;
    now?: Date;
    days?: number;
  } = {},
): Promise<YouTubeAnalyticsSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const youtube =
    deps.youtube === undefined ? youtubeFromConfig() : deps.youtube;
  const days = deps.days ?? WINDOW_DAYS;
  const endDate = dayKey(addDays(now, -1));

  const connector = await recordSyncRun(
    client,
    YOUTUBE_ANALYTICS_CONNECTOR,
    async () => {
      if (!youtube) {
        return skipped(
          "YouTube OAuth is not connected. Run scripts/youtube-oauth-token.mjs once and set YOUTUBE_REFRESH_TOKEN.",
        );
      }
      const campaigns = await campaignByVideoId(client);
      let written = 0;
      let failed = 0;
      for (let offset = 0; offset < days; offset += 1) {
        const day = dayKey(addDays(now, -1 - offset));
        const rows = await youtube.fetchVideoDay(day);
        if (rows.length === 0) continue;

        const { error } = await client.from("youtube_video_daily").upsert(
          rows.map((row) => ({
            video_id: row.videoId,
            day: row.day,
            views: row.views,
            impressions: row.impressions,
            card_impressions: row.cardImpressions,
            card_clicks: row.cardClicks,
            synced_at: now.toISOString(),
          })),
          { onConflict: "video_id,day" },
        );
        if (error)
          throw new Error(
            `youtube_video_daily upsert failed: ${error.message}`,
          );

        const result = await upsertChannelDaily(
          client,
          rows.map((row) =>
            channelRow(row, campaigns.get(row.videoId) ?? null),
          ),
          { now },
        );
        written += rows.length + result.written;
        failed += result.failed;
      }
      return {
        rowsWritten: written,
        error:
          failed > 0
            ? `${failed} channel_daily rows failed to write; see the server log.`
            : null,
      };
    },
  );
  return { endDate, connector };
}

/** Spine row: Seen = thumbnail impressions, Clicked = card clicks. */
export function channelRow(
  row: YouTubeVideoDayRow,
  campaign: string | null,
): ChannelDailyRow {
  return {
    day: row.day,
    source: "youtube",
    medium: "organic",
    campaign,
    content: row.videoId,
    term: null,
    impressions: row.impressions,
    clicks: row.cardClicks,
  };
}

/** youtube_videos.video_id → utm_campaign, so a video's day joins its Bitly clicks and leads. */
async function campaignByVideoId(
  client: SyncClient,
): Promise<Map<string, string>> {
  const { data, error } = await client
    .from("youtube_videos")
    .select("video_id,utm_campaign")
    .not("video_id", "is", null)
    .limit(5000);
  if (error) throw new Error(`youtube_videos read failed: ${error.message}`);
  return new Map(
    (data ?? []).flatMap((row) =>
      row.video_id
        ? [[row.video_id, row.utm_campaign] as [string, string]]
        : [],
    ),
  );
}

function youtubeFromConfig(): YouTubeAnalyticsClient | null {
  const {
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    YOUTUBE_REFRESH_TOKEN,
  } = config;
  if (
    !GOOGLE_OAUTH_CLIENT_ID ||
    !GOOGLE_OAUTH_CLIENT_SECRET ||
    !YOUTUBE_REFRESH_TOKEN
  )
    return null;
  return createYouTubeAnalyticsClient({
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: YOUTUBE_REFRESH_TOKEN,
  });
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
