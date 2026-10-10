import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Booked calls to upload to Google Ads as offline click conversions
 * ("CRM - Booked Call"), read by scripts/google-ads/upload-booked-calls.js.
 *
 * A booked call is a site lead with a Google click id (gclid) whose Close
 * "First Sales Call Booked Date" (`call_booked_at`, a date) is on or after
 * the day the lead came in. A date before it means the person booked before
 * the ad click, so the ad did not produce that call and it is left out.
 */
export const MAX_LOOKBACK_DAYS = 90;

export type BookedCallRow = {
  created_at: string;
  call_booked_at: string;
  gclid: string | null;
};

export type BookedCallConversion = { gclid: string; conversionTime: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pacific calendar day of a timestamp (PDT/PST both handled by Intl). */
function pacificDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

/**
 * One conversion per gclid (its earliest booking). Time: noon Pacific on the
 * booked date (19:00 UTC), never before the lead was created and never in the
 * future, so Google never sees a conversion before its click.
 */
export function toConversions(
  rows: BookedCallRow[],
  now: Date,
): BookedCallConversion[] {
  const byGclid = new Map<string, number>();
  for (const row of rows) {
    const gclid = row.gclid?.trim();
    if (!gclid || !/^[\w-]{10,200}$/.test(gclid)) continue;
    if (row.call_booked_at < pacificDay(row.created_at)) continue;
    const created = new Date(row.created_at).getTime();
    const noon = Date.parse(`${row.call_booked_at}T19:00:00Z`);
    const time = Math.min(
      Math.max(noon, created + 5 * 60 * 1000),
      now.getTime() - 10 * 60 * 1000,
    );
    if (time < created) continue;
    const earlier = byGclid.get(gclid);
    if (earlier === undefined || time < earlier) byGclid.set(gclid, time);
  }
  return [...byGclid].map(([gclid, time]) => ({
    gclid,
    conversionTime: new Date(time).toISOString(),
  }));
}

type Client = Pick<SupabaseClient, "from">;

export async function loadBookedCallConversions(
  days: number,
  now = new Date(),
  client: Client = createAdminClient() as unknown as Client,
): Promise<BookedCallConversion[]> {
  const window = Math.min(Math.max(Math.trunc(days), 1), MAX_LOOKBACK_DAYS);
  const since = new Date(now.getTime() - window * DAY_MS)
    .toISOString()
    .slice(0, 10);
  // Leads older than 90 days cannot be uploaded (Google's click window).
  const clickFloor = new Date(now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const rows: BookedCallRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("lead_submissions")
      .select(
        "created_at, call_booked_at, gclid:metadata->paid_attribution->>gclid",
      )
      .gte("call_booked_at", since)
      .gte("created_at", clickFloor)
      .not("metadata->paid_attribution->>gclid", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error("google ads booked calls: query failed", {
        code: error.code,
        message: error.message,
      });
      throw new Error("Could not read booked calls.");
    }
    rows.push(...((data ?? []) as BookedCallRow[]));
    if (!data || data.length < 1000) break;
  }
  return toConversions(rows, now);
}
