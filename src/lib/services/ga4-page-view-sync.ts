import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { createGa4Client, type Ga4Client } from "@/lib/ga4/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

/**
 * How many trailing days the scheduled run re-pulls.
 *
 * GA4 keeps revising a day for roughly 48 hours after it ends, so a run that
 * only fetched yesterday would permanently store the first, lowest version of
 * every number. Three days costs nothing — the upsert corrects in place.
 */
const DEFAULT_DAYS = 3;

/** Rows per upsert. Keeps the 16k-row backfill off one enormous statement. */
const DEFAULT_CHUNK_SIZE = 1000;

export type Ga4SyncResult = {
  /** False when no service-account key is configured. Never an error. */
  connected: boolean;
  startDate: string;
  endDate: string;
  /** Rows GA4 returned. */
  rows: number;
  /** Rows successfully written. */
  written: number;
  /** Rows in a chunk whose write failed. */
  failed: number;
};

/**
 * Pulls GA4 daily aggregates into `ga4_page_views`.
 *
 * Every channel is stored, not just YouTube: the full history is ~16k rows and
 * keeping all of it means another tab can read this table later without a
 * second backfill. Deciding what counts as YouTube stays in `resolveChannel`.
 */
export async function syncGa4PageViews(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    ga4Client?: Ga4Client | null;
    now?: Date;
    days?: number;
    startDate?: string;
    endDate?: string;
    chunkSize?: number;
  } = {},
): Promise<Ga4SyncResult> {
  const now = deps.now ?? new Date();
  const days = deps.days ?? DEFAULT_DAYS;
  const chunkSize = deps.chunkSize ?? DEFAULT_CHUNK_SIZE;

  const endDate = deps.endDate ?? dayKey(addDays(now, -1));
  const startDate = deps.startDate ?? dayKey(addDays(now, -days));

  const ga4Client =
    deps.ga4Client === undefined ? buildClientFromConfig() : deps.ga4Client;

  const empty: Ga4SyncResult = {
    connected: false,
    startDate,
    endDate,
    rows: 0,
    written: 0,
    failed: 0,
  };
  if (!ga4Client) return empty;

  const fetched = await ga4Client.fetchPageViews({ startDate, endDate });
  const result: Ga4SyncResult = {
    ...empty,
    connected: true,
    rows: fetched.length,
  };
  if (fetched.length === 0) return result;

  const syncedAt = now.toISOString();
  const client = deps.client ?? createAdminClient();

  for (let index = 0; index < fetched.length; index += chunkSize) {
    const chunk = fetched.slice(index, index + chunkSize).map((row) => ({
      day: row.day,
      landing_page: row.landingPage,
      utm_campaign: row.utmCampaign,
      utm_source: row.utmSource,
      screen_page_views: row.screenPageViews,
      sessions: row.sessions,
      engaged_sessions: row.engagedSessions,
      new_users: row.newUsers,
      key_events: row.keyEvents,
      user_engagement_seconds: row.userEngagementSeconds,
      synced_at: syncedAt,
    }));

    const { error } = await client.from("ga4_page_views").upsert(chunk, {
      // Correct a day rather than duplicate it. See the table's primary key.
      //
      // ponytail: a row GA4 stops reporting (thresholding can drop a small
      // one) is left behind rather than deleted. Delete-then-insert would
      // clear it but loses the range outright if the insert then fails.
      // Revisit only if stale rows are ever observed.
      onConflict: "day,landing_page,utm_campaign,utm_source",
    });

    if (error) {
      // One bad chunk must not abandon the rest of a 16k-row backfill.
      // PostgREST errors carry no secrets; without code and message a
      // failed chunk cannot be diagnosed after the fact.
      console.error("ga4 page view upsert failed", {
        startDate,
        endDate,
        chunkRows: chunk.length,
        firstDay: chunk[0]?.day,
        code: error.code,
        message: error.message,
      });
      result.failed += chunk.length;
      continue;
    }
    result.written += chunk.length;
  }

  return result;
}

function buildClientFromConfig(): Ga4Client | null {
  const serviceAccountJson = config.GA4_SERVICE_ACCOUNT_JSON;
  const propertyId = config.GA4_PROPERTY_ID;
  if (!serviceAccountJson || !propertyId) return null;
  try {
    return createGa4Client({ serviceAccountJson, propertyId });
  } catch {
    // An unreadable key is "not connected", same as an absent one.
    return null;
  }
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
