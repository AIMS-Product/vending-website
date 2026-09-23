import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SEARCH_CONSOLE_SOURCE } from "@/lib/analytics/channel";
import { config } from "@/lib/config";
import {
  createSearchConsoleClient,
  type SearchConsoleClient,
  type SearchConsoleDayRow,
} from "@/lib/search-console/client";
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

export const SEARCH_CONSOLE_CONNECTOR = "search-console";

/**
 * Search Console publishes a day two to three days late and keeps restating
 * it for a few more, so each run re-reads ten days ending yesterday and lets
 * the upsert settle them. `days` widens it once for a backfill (Search Console
 * keeps 16 months). One request per run: dimension `date` is one row a day.
 */
const WINDOW_DAYS = 10;

export type SearchConsoleSyncResult = {
  endDate: string;
  connector: SyncRunOutcome;
};

export async function syncSearchConsole(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    searchConsole?: SearchConsoleClient | null;
    now?: Date;
    days?: number;
  } = {},
): Promise<SearchConsoleSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const endDate = dayKey(addDays(now, -1));
  const startDate = dayKey(addDays(now, -(deps.days ?? WINDOW_DAYS)));

  const connector = await recordSyncRun(
    client,
    SEARCH_CONSOLE_CONNECTOR,
    async () => {
      const searchConsole =
        deps.searchConsole === undefined
          ? searchConsoleFromConfig()
          : deps.searchConsole;
      if (!searchConsole) return skipped(notConfiguredReason());

      const rows = await searchConsole.fetchDailyTotals({ startDate, endDate });
      const result = await upsertChannelDaily(client, rows.map(channelRow), {
        now,
      });
      return {
        rowsWritten: result.written,
        error:
          result.failed > 0
            ? `${result.failed} rows failed to write; see the server log.`
            : null,
      };
    },
  );
  return { endDate, connector };
}

/**
 * One spine row per day: Seen = impressions, Clicked = clicks, for Google web
 * search as a whole.
 *
 * Keyed on its own source, `google-search-console` (medium organic, no
 * campaign, content or term), which resolveChannel files under Organic
 * search. Not on GA4's google/organic key, for two reasons. That key is not
 * fixed: it is whatever campaign / content / term GA4 reports for organic
 * sessions that day ("(organic)", "(not provided)", "(not set)"), and a
 * guessed copy of it would open a phantom row beside the real one. And the
 * two are different counts of different things (a search click vs a
 * session), so neither should look like the other's column on one key.
 * GA4's superseded-key clearing only nulls `visits` / `thankyou_visits`, and
 * this row never carries either, so the clearing leaves it alone.
 */
export function channelRow(row: SearchConsoleDayRow): ChannelDailyRow {
  return {
    day: row.day,
    source: SEARCH_CONSOLE_SOURCE,
    medium: "organic",
    campaign: null,
    content: null,
    term: null,
    impressions: row.impressions,
    clicks: row.clicks,
  };
}

/** Null until both the GA4 key and the property are set. */
function searchConsoleFromConfig(): SearchConsoleClient | null {
  const serviceAccountJson = config.GA4_SERVICE_ACCOUNT_JSON;
  const siteUrl = config.GSC_SITE_URL;
  if (!serviceAccountJson || !siteUrl) return null;
  try {
    return createSearchConsoleClient({ serviceAccountJson, siteUrl });
  } catch {
    // An unreadable key is the same as no key: GA4 degrades the same way.
    return null;
  }
}

function notConfiguredReason(): string {
  if (!config.GSC_SITE_URL) return "GSC_SITE_URL is not set.";
  return "GA4_SERVICE_ACCOUNT_JSON is not set or unreadable.";
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
