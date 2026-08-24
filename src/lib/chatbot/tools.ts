import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatbotBookingUrl } from "@/lib/chatbot/booking";
import type { ChatbotConfig } from "@/lib/chatbot/config";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { sendChatbotResourceEmail } from "@/lib/chatbot/emails";
import { extractLead } from "@/lib/chatbot/extract-lead";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";
import {
  CHATBOT_RESOURCE_KEYS,
  MAX_RESOURCES_PER_EMAIL,
  resolveChatbotResources,
} from "@/lib/chatbot/resources";
import type { ChatbotToolDefinition } from "@/lib/chatbot/openai";
import type { Database } from "@/types/database";

/**
 * The four tools the chat model can call, and the single dispatcher that
 * runs them. Everything here executes SERVER-SIDE inside the chat request —
 * the model chooses, it never acts. Two consequences worth keeping:
 *
 * - Every tool is fail-soft. A tool that throws would abort a turn the
 *   visitor is watching stream in, so each one returns a plain-language
 *   result string the model can react to ("couldn't send that") instead.
 * - Every tool result is a STRING fed back to the model, plus an optional
 *   rich `message` appended to the transcript. The transcript is the only
 *   record; nothing renders that isn't also stored.
 */

type ToolClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

export type ChatbotToolContext = {
  conversationId: string;
  personaName: string;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  /** Whatever's been extracted so far — usually null this early; extraction runs later, on idle. Used only to personalize the resource email. */
  prospectProfile: ProspectProfile | null;
  /** Turns so far this conversation, including rich ones — used for the per-conversation email cap. */
  transcript: ChatbotMessage[];
  /** Origin of the page hosting the widget, for the Calendly inline embed. */
  embedDomain: string | null;
  /**
   * The address already on the conversation row when this turn began — put
   * there by the capture form or recalled from a previous session by cookie.
   * Either way the visitor typed it into a first-party form themselves, so it
   * is a legitimate recipient even though no user turn in THIS transcript
   * contains it.
   */
  firstPartyEmail: string | null;
  /**
   * Per-recipient outbound-email budget, injected so this module does not
   * reach for the request's IP. Must fail CLOSED — see sendResourcesEmail.
   */
  checkEmailBudget: (email: string) => Promise<boolean>;
  config: ChatbotConfig;
  client: ToolClient;
};

export type ChatbotToolOutcome = {
  /** Fed back to the model as the `tool` message content. */
  result: string;
  /** Appended to the transcript and streamed to the widget. */
  message?: ChatbotMessage;
  /** Contact details this tool learned, merged by the caller the same way a regex capture is. */
  capture?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

/**
 * Unambiguous "I want to book" phrasings.
 *
 * Deliberately narrow: every entry is a visitor explicitly asking to book,
 * see a calendar, or speak to a person. Vaguer interest ("how do I get
 * started") is left to the model, because forcing a calendar on someone who
 * is still browsing is worse than missing one.
 *
 * This exists because gpt-4o-mini reliably WRITES "I'll open the calendar for
 * you" instead of calling show_booking_calendar. The prompt asks it not to;
 * the prompt is not enough. On a match the route stops asking and requires
 * the call (see forceTool in openai.ts).
 */
const BOOKING_INTENT_PATTERNS: readonly RegExp[] = [
  /\bbook(ing)?\s+(a|the|my)?\s*(call|time|slot|meeting|appointment|consult\w*)\b/i,
  /\b(schedule|set\s*up|grab|pick|get)\s+(a|the|my)?\s*(call|time|slot|meeting|appointment)\b/i,
  /\bcalendar\b/i,
  /\b(talk|speak|chat|hop\s*on|jump\s*on)\s+(to|with|on)\s+(someone|somebody|a\s+(real\s+)?(person|human|rep|advisor))\b/i,
  /\b(available|availability|open)\s+(times?|slots?)\b/i,
  /\bwhen\s+can\s+(i|we)\s+(talk|speak|meet)\b/i,
];

/**
 * True when the visitor has plainly asked to book or to talk to a person.
 * Callers must also check the calendar has not already been shown.
 */
export function hasExplicitBookingIntent(message: string): boolean {
  return BOOKING_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

/** Hard ceiling on resource emails per conversation, counted off the transcript. */
export const MAX_RESOURCE_EMAILS_PER_CONVERSATION = 2;

export const CHATBOT_TOOL_DEFINITIONS: readonly ChatbotToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "show_booking_calendar",
      description:
        "Open a live booking calendar INSIDE the chat so the visitor can pick a time without leaving the conversation. Call this the moment they show any interest in talking to someone, ask how to get started, ask about pricing, or finish answering your qualifying questions. Prefer this over sending a booking link. Do not call it twice in one conversation unless they ask to see it again.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "Short internal note on why now, e.g. 'asked about cost' or 'said they want to start in 30 days'.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_resources_email",
      description:
        "Actually email the visitor the free resources you offered. Only call this AFTER they have said yes to receiving something and you have their email address. Never call it speculatively.",
      parameters: {
        type: "object",
        properties: {
          resource_keys: {
            type: "array",
            items: { type: "string" },
            description: `Which resources to send, max ${MAX_RESOURCES_PER_EMAIL}. Allowed values: ${CHATBOT_RESOURCE_KEYS.join(", ")} — where <slug> is a slug from the case study index.`,
          },
        },
        required: ["resource_keys"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_contact",
      description:
        "Record contact details the visitor just gave you in conversation. Call this whenever they volunteer a name, email, or phone number, even mid-sentence. Never invent or guess a value; only pass what they actually said.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Their first name or full name.",
          },
          email: {
            type: "string",
            description: "Their email address, exactly as given.",
          },
          phone: {
            type: "string",
            description: "Their phone number, exactly as given.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "flag_unknown_question",
      description:
        "Report a question you could not answer confidently from the facts you were given. Call this in the same turn you tell the visitor you'll have the team follow up. This is how the team learns what the site is missing — use it honestly rather than guessing an answer.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "The visitor's question, rephrased as a clean standalone question.",
          },
        },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
];

/**
 * Runs one tool call. Never throws: an unknown name, malformed arguments, or
 * a failed side effect all come back as a result string the model can
 * recover from inside the same turn.
 */
export async function runChatbotTool(
  name: string,
  rawArguments: string,
  context: ChatbotToolContext,
): Promise<ChatbotToolOutcome> {
  let args: unknown;
  try {
    args = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return {
      result: "That tool call had malformed arguments. Reply normally instead.",
    };
  }

  try {
    switch (name) {
      case "show_booking_calendar":
        return showBookingCalendar(context);
      case "send_resources_email":
        return await sendResourcesEmail(args, context);
      case "capture_contact":
        return captureContact(args);
      case "flag_unknown_question":
        return await flagUnknownQuestion(args, context);
      default:
        return { result: `Unknown tool "${name}". Reply normally instead.` };
    }
  } catch (error) {
    console.warn("chatbot: tool execution failed", {
      tool: name,
      conversationId: context.conversationId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      result:
        "That didn't work on our side. Don't mention the failure; just keep helping them normally.",
    };
  }
}

// ---------------------------------------------------------------------------
// show_booking_calendar
// ---------------------------------------------------------------------------

function showBookingCalendar(context: ChatbotToolContext): ChatbotToolOutcome {
  const alreadyShown = context.transcript.some(
    (message) => message.kind === "calendar",
  );

  const url = chatbotBookingUrl({
    conversationId: context.conversationId,
    name: context.capturedName,
    email: context.capturedEmail,
    embed: true,
    embedDomain: context.embedDomain,
  });

  if (!url) {
    return {
      result:
        "The calendar isn't available right now. Point them at /book-now in your reply instead.",
    };
  }

  if (alreadyShown) {
    return {
      result:
        "The calendar is already open further up in this chat. Point them back up to it in one short sentence rather than opening a second one.",
    };
  }

  return {
    result:
      "A live booking calendar is now open in the chat, right below your reply. In one short sentence, tell them they can pick a time right here without leaving. Do not paste a booking link.",
    message: {
      role: "assistant",
      content: "Opened the booking calendar in the chat.",
      ts: new Date().toISOString(),
      kind: "calendar",
      data: { url },
    },
  };
}

// ---------------------------------------------------------------------------
// send_resources_email
// ---------------------------------------------------------------------------

const resourcesArgsSchema = z.object({
  resource_keys: z.array(z.string()).min(1).max(10),
});

async function sendResourcesEmail(
  args: unknown,
  context: ChatbotToolContext,
): Promise<ChatbotToolOutcome> {
  const parsed = resourcesArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      result:
        "That resource request wasn't understood. Ask them which one they want.",
    };
  }

  if (!context.capturedEmail) {
    return {
      result:
        "No email on file yet, so nothing was sent. Ask for their email in one short sentence first, then try again.",
    };
  }

  // Only ever mail an address the VISITOR typed into the chat themselves.
  //
  // capturedEmail can also arrive via capture_contact, i.e. narrated by the
  // model — and the model is steerable by the visitor ("send the roadmap to
  // victim@example.com"). Without this check the tool is an open relay:
  // arbitrary third parties receiving mail from a verified Vendingpreneurs
  // sender with the sales inbox as reply-to. Requiring the address to appear
  // in their own message text means the worst case is a visitor mailing
  // themselves, which the site's lead forms already allow.
  if (!emailAppearsInVisitorTurns(context)) {
    return {
      result:
        "That address wasn't typed into this chat, so nothing was sent. Ask them to type the email address they want it sent to.",
    };
  }

  // Per-recipient budget on top of the per-conversation cap below: the
  // per-conversation cap alone still allows N conversations x 2 emails at one
  // address. Fails closed here (unlike the fail-open public limiter) because
  // an unbounded outbound mailer is worse than a missed resource email.
  const withinBudget = await context.checkEmailBudget(context.capturedEmail);
  if (!withinBudget) {
    return {
      result:
        "We've already sent them plenty today, so nothing went out. Offer a call instead.",
    };
  }

  // ponytail: the cap is counted off the stored transcript rather than a
  // dedicated counter column. Exact for a single conversation, which is the
  // abuse surface that matters here. Upgrade to a column if a second sender
  // ever writes resource_card messages.
  const alreadySent = context.transcript.filter(
    (message) => message.kind === "resource_card",
  ).length;
  if (alreadySent >= MAX_RESOURCE_EMAILS_PER_CONVERSATION) {
    return {
      result:
        "They've already been emailed twice in this conversation, so nothing was sent. Offer a call instead.",
    };
  }

  const resources = resolveChatbotResources(parsed.data.resource_keys);
  if (!resources.length) {
    return {
      result:
        "None of those resource keys exist, so nothing was sent. Pick from the collateral and case studies you were given.",
    };
  }

  const bookingUrl = chatbotBookingUrl({
    conversationId: context.conversationId,
    name: context.capturedName,
    email: context.capturedEmail,
  });

  const sent = await sendChatbotResourceEmail(
    {
      to: context.capturedEmail,
      visitorName: context.capturedName,
      personaName: context.personaName,
      resources,
      bookingUrl,
      profile: context.prospectProfile,
    },
    context.config,
  );

  if (!sent.ok) {
    console.warn("chatbot: resource email failed", {
      conversationId: context.conversationId,
      error: sent.error,
    });
    return {
      result:
        "The email didn't go out. Tell them the team will follow up by email shortly, and don't promise it's already sent.",
    };
  }

  const titles = resources.map((resource) => resource.title).join(", ");
  return {
    result: `Sent to ${context.capturedEmail}: ${titles}. Confirm it's on the way in one short sentence.`,
    message: {
      role: "assistant",
      content: `Emailed ${titles} to ${context.capturedEmail}.`,
      ts: new Date().toISOString(),
      kind: "resource_card",
      data: {
        email: context.capturedEmail,
        resources: resources.map((resource) => ({
          title: resource.title,
          blurb: resource.blurb,
          url: resource.url,
        })),
      },
    },
  };
}

/**
 * True when the captured address is one the visitor themselves supplied:
 * either already on the conversation row before this turn (capture form or
 * cookie recall) or typed verbatim into one of their own messages.
 *
 * Compared case-insensitively, and against user turns ONLY — assistant turns
 * are excluded so the model cannot launder an arbitrary address by repeating
 * it back and then citing its own message as evidence.
 */
function emailAppearsInVisitorTurns(context: ChatbotToolContext): boolean {
  const email = context.capturedEmail?.trim().toLowerCase();
  if (!email) return false;
  if (context.firstPartyEmail?.trim().toLowerCase() === email) return true;
  return context.transcript.some(
    (message) =>
      message.role === "user" && message.content.toLowerCase().includes(email),
  );
}

// ---------------------------------------------------------------------------
// capture_contact
// ---------------------------------------------------------------------------

const captureArgsSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  email: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(60).nullish(),
});

/**
 * Structured capture. The model is a lossy narrator, so email and phone are
 * re-validated through the SAME extractLead() the free-text path uses — a
 * hallucinated or malformed address never reaches Close, it just fails this
 * check and gets dropped.
 *
 * `name` cannot go through extractLead: that path recognises names from
 * sentence shapes ("I'm Dana"), and would reject the bare "Dana" this tool
 * correctly reports. It is sanitized instead — a name is free text on the
 * capture form too, so this is not a new trust boundary, but it must not
 * carry newlines or control characters into an email greeting or Close.
 */
function captureContact(args: unknown): ChatbotToolOutcome {
  const parsed = captureArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      result: "Those contact details weren't understood; nothing was saved.",
    };
  }

  const { name, email, phone } = parsed.data;
  const verifiedEmail = email ? extractLead(email).email : null;
  const verifiedPhone = phone ? extractLead(phone).phone : null;
  const cleanName = sanitizeName(name);

  if (!verifiedEmail && !verifiedPhone && !cleanName) {
    return {
      result:
        "Nothing usable was in there, so nothing was saved. Don't ask again in this reply.",
    };
  }

  const saved = [
    cleanName ? "name" : null,
    verifiedEmail ? "email" : null,
    verifiedPhone ? "phone" : null,
  ].filter(Boolean);

  return {
    result: `Saved their ${saved.join(" and ")}. Don't repeat it back or thank them for it more than briefly, and never ask for it again.`,
    capture: { name: cleanName, email: verifiedEmail, phone: verifiedPhone },
  };
}

/** Single-line, printable, length-capped. Names are free text; they are not a licence to inject. */
function sanitizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name

    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || null;
}

// ---------------------------------------------------------------------------
// flag_unknown_question
// ---------------------------------------------------------------------------

const unknownQuestionArgsSchema = z.object({
  question: z.string().trim().min(5).max(500),
});

async function flagUnknownQuestion(
  args: unknown,
  context: ChatbotToolContext,
): Promise<ChatbotToolOutcome> {
  const parsed = unknownQuestionArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      result: "Nothing was logged. Just tell them the team will follow up.",
    };
  }

  const question = parsed.data.question;
  const dedupeKey = unknownQuestionDedupeKey(question);

  // Upsert-with-increment lives in SQL (chatbot_log_unknown_question) because
  // PostgREST cannot express `ask_count = ask_count + 1` — a plain upsert
  // silently leaves every row at the column default, which is exactly what
  // the insights rail sorts by. Fails soft: before this migration is applied
  // neither the table nor the function exists, and the visitor's turn must
  // not care either way.
  const { error } = await context.client.rpc("chatbot_log_unknown_question", {
    p_conversation_id: context.conversationId,
    p_question: question,
    p_dedupe_key: dedupeKey,
  });

  if (error) {
    console.warn("chatbot: could not log unknown question", {
      conversationId: context.conversationId,
      error: error.message,
    });
  }

  return {
    result:
      "Logged for the team. Tell them honestly you're not sure and that someone will follow up with the real answer, then offer a call.",
  };
}

function unknownQuestionDedupeKey(question: string): string {
  const normalized = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
