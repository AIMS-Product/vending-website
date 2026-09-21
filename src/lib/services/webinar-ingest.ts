import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  recordSyncRun,
  upsertChannelDaily,
  type ChannelDailyRow,
} from "@/lib/services/channel-daily";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type IngestClient = Pick<SupabaseClient<Database>, "from">;

export const WEBINAR_INGEST_CONNECTOR = "webinar-ingest";

/** The only version this receiver understands. The sender bumps on breaking change. */
export const INGEST_VERSION = 1;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");
/** Null means not observed. Never coerced to zero. */
const count = z.number().int().min(0).nullable();
const money = z.number().min(0).nullable();

const webinarSchema = z.object({
  date: day,
  label: z.string().min(1).max(200),
  format: z.string().min(1).max(40),
  spend: money,
  registrations: count,
  registrationsAdAttributed: count,
  attendees: count,
  peakAttendees: count,
  attendeesAtOffer: count,
  bookedWithin7d: count,
  // Close's tag cohort. Disclosed for comparison, never a denominator: the event tag goes missing on
  // precisely the people who book, so it is a different population from the outcomes below.
  // Optional so a sender older than 2026-09-13 still validates; it lands null and the rate stays a dash.
  bookedEver: count.optional(),
  // The count of record: rows on the Booked Calls sheet. `showed`, `won` and `revenue` are counted over
  // THIS population, so it is their denominator. Optional so a sender older than 2026-09-17 still
  // validates; it lands null and the rate stays a dash rather than dividing by the tag cohort again.
  bookedCalls: count.optional(),
  bookedNightOf: count,
  showed: count,
  // Leads a rep marked shown with no booked date. Disclosed, never added to showed.
  showNoBooking: count.optional(),
  won: count,
  revenue: money,
  pitchStartMin: z.number().int().nullable(),
  lengthMin: z.number().int().nullable(),
  notes: z.string().max(2000).nullable(),
  bookingMaturing: z.boolean(),
  revenueMaturing: z.boolean(),
});

const audienceSchema = z.object({
  day,
  channel: z.literal("webinar"),
  source: z.enum(["meta_ads", "unattributed"]),
  medium: z.enum(["paid", "organic"]),
  campaign: z.string().min(1).max(120),
  content: z.enum(["warm", "cold", "unattributed"]),
  destination: z.literal("webinar-register"),
  spend: z.number().min(0),
  leads: z.number().int().min(0),
  booked: count,
  showed: count,
  won: count,
});

export const ingestPayloadSchema = z.object({
  version: z.literal(INGEST_VERSION),
  sentAt: z.string(),
  pulledAt: z.record(z.string(), z.string()),
  // Bounded: today's payload is ~10 webinars and ~30 audience rows.
  webinars: z.array(webinarSchema).max(500),
  audiences: z.array(audienceSchema).max(5000),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export class WebinarIngestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "WebinarIngestError";
    this.status = status;
  }
}

export type WebinarIngestResult = {
  webinarsWritten: number;
  audiencesWritten: number;
};

/**
 * Receives one snapshot from vp-webinars and lands it in two places: every
 * webinar row into `webinar_events` (by date) and every audience row onto the
 * channel spine (channel Webinar, destination webinar-register). Both are
 * upserts, so the daily re-send is idempotent. The run is recorded either way
 * so a rejected payload shows red on the Channels tab instead of vanishing.
 */
export async function ingestWebinarSnapshot(
  body: unknown,
  deps: { client?: IngestClient; now?: Date } = {},
): Promise<WebinarIngestResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? new Date();

  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue
      ? `Invalid payload at ${issue.path.join(".") || "root"}: ${issue.message}`
      : "Invalid payload.";
    await recordSyncRun(client, WEBINAR_INGEST_CONNECTOR, async () => {
      throw new WebinarIngestError(message);
    });
    throw new WebinarIngestError(message);
  }
  const payload = parsed.data;

  let result: WebinarIngestResult = { webinarsWritten: 0, audiencesWritten: 0 };
  const outcome = await recordSyncRun(
    client,
    WEBINAR_INGEST_CONNECTOR,
    async () => {
      result = await write(client, payload, now);
      return { rowsWritten: result.webinarsWritten + result.audiencesWritten };
    },
    { now: () => now },
  );
  if (outcome.error) throw new WebinarIngestError(outcome.error, 500);
  return result;
}

async function write(
  client: IngestClient,
  payload: IngestPayload,
  now: Date,
): Promise<WebinarIngestResult> {
  const receivedAt = now.toISOString();
  let webinarsWritten = 0;
  if (payload.webinars.length > 0) {
    const { error } = await client.from("webinar_events").upsert(
      payload.webinars.map((w) => ({
        date: w.date,
        label: w.label,
        format: w.format,
        spend: w.spend,
        registrations: w.registrations,
        registrations_ad_attributed: w.registrationsAdAttributed,
        attendees: w.attendees,
        peak_attendees: w.peakAttendees,
        attendees_at_offer: w.attendeesAtOffer,
        booked_within_7d: w.bookedWithin7d,
        booked_ever: w.bookedEver ?? null,
        booked_calls: w.bookedCalls ?? null,
        booked_night_of: w.bookedNightOf,
        showed: w.showed,
        show_no_booking: w.showNoBooking ?? null,
        won: w.won,
        revenue: w.revenue,
        pitch_start_min: w.pitchStartMin,
        length_min: w.lengthMin,
        notes: w.notes,
        booking_maturing: w.bookingMaturing,
        revenue_maturing: w.revenueMaturing,
        pulled_at: payload.pulledAt,
        received_at: receivedAt,
      })),
      { onConflict: "date" },
    );
    if (error) {
      throw new Error(`webinar_events upsert failed: ${error.message}`);
    }
    webinarsWritten = payload.webinars.length;
  }

  // Already in spine shape; channelDailyKey still normalises and resolves
  // "webinar" to the Webinar channel and webinar-register to its destination.
  // Spend stays on webinar_events: the spine's spend is owned by metricool-ads,
  // per campaign per day, and the sheet's per-webinar lump would double it.
  const rows: ChannelDailyRow[] = payload.audiences.map((a) => ({
    day: a.day,
    channel: a.channel,
    source: a.source,
    medium: a.medium,
    campaign: a.campaign,
    content: a.content,
    term: a.destination,
    leads: a.leads,
    // Booked is deliberately NOT taken from the sheet. A webinar's bookings
    // reach the spine already, through the tagged Calendly links the webinar
    // sends people to, and Calendly is the system of record for a booking.
    // Writing the sheet's count as well counted every webinar booking twice:
    // on 2026-09-08 the spine read 74 where Calendly and webinar_events both
    // say ~34. Written as an explicit null so the sender's next full-history
    // send clears the doubled rows through the normal path.
    // The sheet's own booked numbers keep their home on `webinar_events`,
    // which is where webinar booking and show rates belong.
    booked: null,
    // Same reasoning, and it should have been applied here at the same time.
    // These are not the cohort's outcomes: vp-webinars joins a Close outcome
    // back to an ad set by matching the booker's email to a GHL registrant,
    // and that join only partly lands (Sept 1: 13 of 27 bookings; Aug 18: 35
    // of 78). What arrives is a floor, and on 2026-09-21 it was a 5% one --
    // 57 shows and 1 win on the spine against 66 shows and 2 wins in the same
    // four cohorts. Rendered beside a full `booked` count from the tagged
    // Calendly links, a floor reads as the whole truth and understates the
    // webinar by an order of magnitude.
    //
    // `webinar_events` already holds all six stages for every cohort, counted
    // over one population, and that is where a webinar's show and close rates
    // belong. The spine keeps what ad-set attribution can honestly carry: who
    // the ads acquired, and what they cost.
    showed: null,
    won: null,
  }));
  const spine = await upsertChannelDaily(client, rows, { now });
  if (spine.failed > 0) {
    throw new Error(`${spine.failed} channel_daily rows failed to write.`);
  }
  return { webinarsWritten, audiencesWritten: spine.written };
}
