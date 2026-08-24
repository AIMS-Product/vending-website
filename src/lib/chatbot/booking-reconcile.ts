import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyChatbotBookingAttribution } from "@/lib/chatbot/booking-attribution";
import { stampChatbotBookingOnCloseLead } from "@/lib/chatbot/close-booking-note";
import { config } from "@/lib/config";
import {
  createCalendlyApiClient,
  type CalendlyInvitee,
  type CalendlyScheduledEvent,
} from "@/lib/services/calendly-api";
import { recordCalendlyBooking } from "@/lib/services/calendly-bookings";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Backfills bookings the Calendly webhook missed (production never had
 * CALENDLY_WEBHOOK_SIGNING_KEY set, so every production delivery has 401'd
 * since the domain cutover). Reads Calendly's own event/invitee history for
 * the window and feeds each invitee through the exact same
 * recordCalendlyBooking + applyChatbotBookingAttribution path the webhook
 * uses, so both attribution matchers (in_chat, email_match) apply for free.
 *
 * SCOPE: bookings only, never cancellations. The sweep lists active events and
 * skips non-active invitees, so a call that was booked and later cancelled
 * stays booked in our tables until the Calendly webhook works again or Close's
 * reconciler clears the linked lead. Recording a cancelled invitee as
 * "invitee.created" would be strictly worse, so this is a known gap rather
 * than an oversight.
 *
 * Safe to re-run: recordCalendlyBooking upserts on invitee_uri, and
 * applyChatbotBookingAttribution's own guards (isInChatAttributed,
 * isCancelGuarded, the booked_event_uri check) make re-processing an
 * already-attributed conversation a no-op. See both files' own doc comments.
 */

type ReconcileClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far ahead to look for calls that have been booked but not yet held.
 * Calendly's own scheduling horizon for these event types is well inside this,
 * so it is a ceiling rather than a filter.
 */
const FORWARD_WINDOW_DAYS = 120;

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 90;

export type ReconcileChatbotBookingsOptions = {
  lookbackDays?: number;
  dryRun?: boolean;
  /**
   * HTTP call ceiling. Left at the client default for the daily cron; raised
   * only for a deliberate one-off backfill, where the full history needs far
   * more than one day's worth of requests.
   */
  maxRequests?: number;
};

export type ReconcileChatbotBookingsDeps = {
  fetchImpl?: typeof fetch;
  supabaseClient?: ReconcileClient;
  token?: string;
  now?: Date;
};

export type ReconcileChatbotBookingsResult = {
  configured: boolean;
  dryRun: boolean;
  eventsScanned: number;
  inviteesSeen: number;
  bookingsRecorded: number;
  attributed: { inChat: number; emailMatch: number };
  skipped: number;
  errors: Array<{ inviteeUri: string | null; message: string }>;
};

function emptyResult(
  configured: boolean,
  dryRun: boolean,
): ReconcileChatbotBookingsResult {
  return {
    configured,
    dryRun,
    eventsScanned: 0,
    inviteesSeen: 0,
    bookingsRecorded: 0,
    attributed: { inChat: 0, emailMatch: 0 },
    skipped: 0,
    errors: [],
  };
}

function clampLookbackDays(days: number | undefined): number {
  if (!days || !Number.isFinite(days) || days <= 0) {
    return DEFAULT_LOOKBACK_DAYS;
  }
  return Math.min(days, MAX_LOOKBACK_DAYS);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function toWebhookEvent(
  invitee: CalendlyInvitee,
  event: CalendlyScheduledEvent,
): CalendlyWebhookEvent {
  const tracking = invitee.tracking ?? null;
  return {
    eventKind: "invitee.created",
    inviteeUri: invitee.uri,
    inviteeName: invitee.name ?? null,
    inviteeEmail: invitee.email ?? null,
    cancelReason: null,
    utmSource: tracking?.utm_source ?? null,
    utmMedium: tracking?.utm_medium ?? null,
    utmCampaign: tracking?.utm_campaign ?? null,
    utmTerm: tracking?.utm_term ?? null,
    utmContent: tracking?.utm_content ?? null,
    scheduledEventUri: event.uri,
    scheduledEventName: event.name ?? null,
    eventStartAt: event.start_time ?? null,
    eventEndAt: event.end_time ?? null,
    // Calendly's own record of when they booked. Without it every backfilled
    // booking would be stamped with the sweep's run time and land in the
    // wrong funnel window.
    inviteeCreatedAt: invitee.created_at ?? null,
    rawPayload: { invitee, scheduledEvent: event },
  };
}

/**
 * Wraps a real Supabase client so recordCalendlyBooking /
 * applyChatbotBookingAttribution can run UNMODIFIED in dry-run mode: every
 * read (select/eq/order/limit/maybeSingle/ilike) passes through to the real
 * client so matching logic is exercised for real, but the three calls those
 * two functions make to actually write (upsert, update, rpc) resolve as a
 * no-op success instead of touching the database. This is what lets dry-run
 * report an accurate prediction without re-implementing either function's
 * matching rules here.
 *
 * ponytail: only intercepts the specific write calls those two functions are
 * known (by reading them) to make. A future write added to either function
 * would leak through in dry-run unless this list is extended to match.
 */
function createDryRunClient(real: ReconcileClient): ReconcileClient {
  const noopResult = () => Promise.resolve({ data: null, error: null });

  return {
    from(table: string) {
      const builder = (real.from as (t: string) => object)(table);
      return new Proxy(builder, {
        get(target, prop, receiver) {
          if (prop === "upsert") return noopResult;
          if (prop === "update") return () => ({ eq: noopResult });
          return Reflect.get(target, prop, receiver);
        },
      });
    },
    rpc: noopResult,
  } as unknown as ReconcileClient;
}

async function processInvitee(
  invitee: CalendlyInvitee,
  event: CalendlyScheduledEvent,
  clients: { realClient: ReconcileClient; writeClient: ReconcileClient },
  summary: ReconcileChatbotBookingsResult,
): Promise<void> {
  const webhookEvent = toWebhookEvent(invitee, event);

  try {
    const { data: existing, error: existingError } = await clients.realClient
      .from("calendly_bookings")
      .select("invitee_uri")
      .eq("invitee_uri", webhookEvent.inviteeUri)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    const isNew = !existing;

    await recordCalendlyBooking(clients.writeClient, webhookEvent);
    if (isNew) summary.bookingsRecorded += 1;

    const attribution = await applyChatbotBookingAttribution(
      clients.writeClient,
      webhookEvent,
    );
    if (attribution.matched) {
      if (attribution.attributionSource === "in_chat") {
        summary.attributed.inChat += 1;
      } else {
        summary.attributed.emailMatch += 1;
      }

      // Same "came via chatbot" note the webhook writes, so a booking this
      // sweep backfills is as visible to a rep in Close as a live one.
      //
      // Skipped entirely on a dry run: createDryRunClient only intercepts
      // Supabase writes, and this call reaches OUT to Close. A rehearsal that
      // wrote real CRM notes would not be a rehearsal.
      if (!summary.dryRun) {
        await stampChatbotBookingOnCloseLead({
          conversationId: attribution.conversationId,
          attributionSource: attribution.attributionSource,
          scheduledEventName: webhookEvent.scheduledEventName,
          eventStartAt: webhookEvent.eventStartAt,
        });
      }
    } else {
      summary.skipped += 1;
    }
  } catch (error) {
    summary.errors.push({
      inviteeUri: webhookEvent.inviteeUri ?? null,
      message: errorMessage(error),
    });
  }
}

export async function reconcileChatbotBookings(
  options: ReconcileChatbotBookingsOptions = {},
  deps: ReconcileChatbotBookingsDeps = {},
): Promise<ReconcileChatbotBookingsResult> {
  const dryRun = options.dryRun ?? false;
  const token = deps.token ?? config.CALENDLY_API_TOKEN;

  if (!token) return emptyResult(false, dryRun);

  const lookbackDays = clampLookbackDays(options.lookbackDays);
  const now = deps.now ?? new Date();
  // Calendly filters /scheduled_events by when the CALL starts, not by when it
  // was booked. Capping max_start_time at now would therefore return only
  // calls that have already happened and miss every upcoming one, which is
  // most of what a booking sweep exists to find: someone booking today books
  // for next week. So the window reaches forward as well as back.
  const minStartTime = new Date(
    now.getTime() - lookbackDays * DAY_MS,
  ).toISOString();
  const maxStartTime = new Date(
    now.getTime() + FORWARD_WINDOW_DAYS * DAY_MS,
  ).toISOString();

  const realClient = deps.supabaseClient ?? createAdminClient();
  const writeClient = dryRun ? createDryRunClient(realClient) : realClient;
  const calendly = createCalendlyApiClient({
    token,
    fetchImpl: deps.fetchImpl,
    ...(options.maxRequests ? { maxRequests: options.maxRequests } : {}),
  });

  const summary = emptyResult(true, dryRun);

  // A thrown Calendly error (the request cap, a 5xx after retries, a bad
  // response shape) must not 500 the route and discard the counts: every write
  // already made is durable and idempotent, so the honest outcome is a partial
  // summary with the reason recorded.
  let events: CalendlyScheduledEvent[];
  try {
    const organizationUri = await calendly.getCurrentOrganizationUri();
    events = await calendly.listScheduledEvents({
      organizationUri,
      minStartTime,
      maxStartTime,
    });
  } catch (error) {
    summary.errors.push({ inviteeUri: null, message: errorMessage(error) });
    return summary;
  }
  summary.eventsScanned = events.length;

  for (const event of events) {
    let invitees: CalendlyInvitee[];
    try {
      invitees = await calendly.listEventInvitees(event.uri);
    } catch (error) {
      summary.errors.push({ inviteeUri: null, message: errorMessage(error) });
      continue;
    }

    for (const invitee of invitees) {
      summary.inviteesSeen += 1;

      // A canceled invitee on an otherwise-active event is not a booking to
      // backfill; recordCalendlyBooking with eventKind "invitee.created"
      // would wrongly mark it "booked". The sweep only backfills creates.
      if (invitee.status !== "active") {
        summary.skipped += 1;
        continue;
      }

      await processInvitee(
        invitee,
        event,
        { realClient, writeClient },
        summary,
      );
    }
  }

  return summary;
}
