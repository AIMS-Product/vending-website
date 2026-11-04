import "server-only";

import { z } from "zod";
import {
  CHATBOT_BOOKING_UTM_MEDIUM,
  CHATBOT_BOOKING_UTM_SOURCE,
} from "@/lib/chatbot/booking";
import {
  resolveBookingCalendar,
  safeTimeZone,
} from "@/lib/chatbot/availability";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import {
  chatbotInviteeEvent,
  recordChatbotBooking,
} from "@/lib/chatbot/record-booking";
import { config } from "@/lib/config";
import {
  CalendlyApiError,
  createCalendlyApiClient,
} from "@/lib/services/calendly-api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The chat books the call itself (propose_call_time, then book_call).
 *
 * Two steps on purpose, and the server enforces both: a time is booked only
 * if this chat PROPOSED that exact slot earlier (a `booking_proposed` message
 * in the transcript) AND the visitor has sent a message since. The model
 * judges whether that message is a yes; the server makes sure it could not
 * book a time the visitor never saw, or book in the same turn it asked.
 */

export type BookCallContext = {
  conversationId: string;
  capturedName: string | null;
  capturedEmail: string | null;
  transcript: ChatbotMessage[];
  timeZone?: string | null;
};

export type BookCallOutcome = { result: string; message?: ChatbotMessage };

type Calendly = Pick<
  ReturnType<typeof createCalendlyApiClient>,
  "createInvitee" | "getScheduledEvent"
>;

export type BookCallDeps = {
  resolveCalendar: typeof resolveBookingCalendar;
  calendly: () => Calendly;
  record: (event: ReturnType<typeof chatbotInviteeEvent>) => Promise<void>;
  now: () => Date;
};

const defaultDeps: BookCallDeps = {
  resolveCalendar: resolveBookingCalendar,
  calendly: () =>
    createCalendlyApiClient({
      token: config.CALENDLY_API_TOKEN,
      maxRequests: 3,
    }),
  record: (event) =>
    recordChatbotBooking(createAdminClient(), event, "chatbot book_call"),
  now: () => new Date(),
};

const argsSchema = z.object({ start_time: z.string().trim().min(10).max(40) });

export function formatSlot(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function parseStart(args: unknown): number | null {
  const parsed = argsSchema.safeParse(args);
  if (!parsed.success) return null;
  const ms = Date.parse(parsed.data.start_time);
  return Number.isFinite(ms) ? ms : null;
}

function isBooked(transcript: ChatbotMessage[]): boolean {
  return transcript.some((m) => m.kind === "booking_confirmed");
}

const ALREADY_BOOKED =
  "They already have a call booked in this chat. Do not book another; answer their question.";
const BAD_TIME =
  "That start_time was not understood. Pass the exact ISO time from get_available_times.";

export async function proposeCallTime(
  args: unknown,
  context: BookCallContext,
  deps: BookCallDeps = defaultDeps,
): Promise<BookCallOutcome> {
  if (isBooked(context.transcript)) return { result: ALREADY_BOOKED };
  const startMs = parseStart(args);
  if (startMs === null) return { result: BAD_TIME };

  const timeZone = safeTimeZone(context.timeZone);
  const { calendar, slots } = await deps.resolveCalendar({ timeZone });
  const slot = slots.find((s) => Date.parse(s) === startMs);
  if (!slot) {
    return {
      result:
        "That time is not open. Nothing was proposed. Call get_available_times and offer a time from its list.",
    };
  }

  const label = formatSlot(slot, timeZone);
  const missing = [
    context.capturedName ? null : "first name",
    context.capturedEmail ? null : "email",
  ].filter(Boolean);
  const ask = missing.length
    ? ` You still need their ${missing.join(" and ")} to book: ask for ${missing.length > 1 ? "them" : "it"} in this same message.`
    : "";

  return {
    result: `Proposed ${label}; a line showing it is now in the chat. Ask them plainly to confirm that time (one short question). Do not say it is booked: it is NOT booked until they say yes and you call book_call with the same start_time.${ask}`,
    message: {
      role: "assistant",
      content: `Proposed time: ${label}. Reply yes and it's booked.`,
      ts: deps.now().toISOString(),
      kind: "booking_proposed",
      data: { start_time: slot, event_type_uri: calendar.eventTypeUri },
    },
  };
}

/** The latest proposal, and whether the visitor has written since it. */
function latestProposal(transcript: ChatbotMessage[]) {
  const index = transcript.findLastIndex((m) => m.kind === "booking_proposed");
  if (index < 0) return null;
  const data = transcript[index].data ?? {};
  const startTime =
    typeof data.start_time === "string" ? data.start_time : null;
  const eventTypeUri =
    typeof data.event_type_uri === "string" ? data.event_type_uri : null;
  if (!startTime || !eventTypeUri) return null;
  const answered = transcript.slice(index + 1).some((m) => m.role === "user");
  return { startTime, eventTypeUri, answered };
}

export async function bookCall(
  args: unknown,
  context: BookCallContext,
  deps: BookCallDeps = defaultDeps,
): Promise<BookCallOutcome> {
  if (isBooked(context.transcript)) return { result: ALREADY_BOOKED };
  const startMs = parseStart(args);
  if (startMs === null) return { result: BAD_TIME };

  const proposal = latestProposal(context.transcript);
  if (!proposal || Date.parse(proposal.startTime) !== startMs) {
    return {
      result:
        "Not booked: that exact time was never proposed in this chat. Call propose_call_time first and wait for their yes.",
    };
  }
  if (!proposal.answered) {
    return {
      result:
        "Not booked: they have not replied to the proposed time yet. Ask them to confirm and wait for their answer.",
    };
  }
  if (!context.capturedName || !context.capturedEmail) {
    return {
      result:
        "Not booked: you need their first name and email first. Ask for whichever is missing; the time is still proposed.",
    };
  }
  if (startMs <= deps.now().getTime() + 5 * 60_000) {
    return {
      result:
        "Not booked: that time has passed or is minutes away. Call get_available_times and propose another.",
    };
  }

  const timeZone = safeTimeZone(context.timeZone);
  const calendly = deps.calendly();
  let invitee;
  try {
    invitee = await calendly.createInvitee({
      eventTypeUri: proposal.eventTypeUri,
      startTime: new Date(startMs).toISOString(),
      name: context.capturedName,
      email: context.capturedEmail,
      timeZone,
      tracking: {
        utm_source: CHATBOT_BOOKING_UTM_SOURCE,
        utm_medium: CHATBOT_BOOKING_UTM_MEDIUM,
        utm_content: context.conversationId,
        utm_campaign: null,
        utm_term: null,
        salesforce_uuid: null,
      },
    });
  } catch (error) {
    const status = error instanceof CalendlyApiError ? error.status : 0;
    console.warn("chatbot book_call: Calendly refused", {
      conversationId: context.conversationId,
      status,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    if (status === 400 || status === 409) {
      return {
        result:
          "Not booked: Calendly says that slot was just taken. Apologise briefly, call get_available_times, and propose the nearest open time.",
      };
    }
    // 401/403 (token lacks scheduled_events:write), timeouts, outages. A
    // timeout may still have booked; the webhook records it if so.
    return {
      result:
        "Booking from the chat is not working right now. Do not say it is booked. Call show_booking_calendar so they can take the time themselves.",
    };
  }
  if (!invitee) {
    return {
      result:
        "Booking could not be confirmed. Do not say it is booked. Call show_booking_calendar so they can take the time themselves.",
    };
  }

  const scheduled = invitee.event
    ? await calendly.getScheduledEvent(invitee.event).catch((error) => {
        console.warn("chatbot book_call: scheduled event lookup failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        return null;
      })
    : null;
  await deps.record(chatbotInviteeEvent(invitee, scheduled, "chat_book_call"));

  const label = formatSlot(proposal.startTime, timeZone);
  return {
    result: `Booked for ${label}. Calendly is emailing ${context.capturedEmail} the invite. Confirm it warmly in one or two sentences and tell them to watch for the calendar email.`,
    message: {
      role: "assistant",
      content: "Booked. Check your email for the calendar invite.",
      ts: deps.now().toISOString(),
      kind: "booking_confirmed",
      data: {
        event_uri: invitee.event ?? null,
        starts_at: scheduled?.start_time ?? proposal.startTime,
      },
    },
  };
}
