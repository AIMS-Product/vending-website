import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chatbotBookingUrl } from "@/lib/chatbot/booking";
import type { ChatbotConfig } from "@/lib/chatbot/config";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { sendChatbotResourceEmail } from "@/lib/chatbot/emails";
import { extractLead } from "@/lib/chatbot/extract-lead";
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

type ToolClient = Pick<SupabaseClient<Database>, "from">;

export type ChatbotToolContext = {
  conversationId: string;
  personaName: string;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  /** Turns so far this conversation, including rich ones — used for the per-conversation email cap. */
  transcript: ChatbotMessage[];
  /** Origin of the page hosting the widget, for the Calendly inline embed. */
  embedDomain: string | null;
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
          note: {
            type: "string",
            description:
              "One friendly sentence, in your own voice, on why you're sending these. No markdown.",
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
  note: z.string().trim().max(400).nullish(),
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
      note: parsed.data.note ?? null,
      bookingUrl,
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

// ---------------------------------------------------------------------------
// capture_contact
// ---------------------------------------------------------------------------

const captureArgsSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  email: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(60).nullish(),
});

/**
 * Structured capture. The model is a lossy narrator, so every value it
 * reports is re-validated through the SAME extractLead() the free-text path
 * uses — a hallucinated or malformed email never reaches Close, it just
 * fails this check and gets dropped.
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
  const cleanName = name?.trim() || null;

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

  // Upsert on the normalized key so the same gap asked a hundred ways is one
  // row. The count bump is a separate best-effort RPC-free update: losing a
  // count is harmless, losing the row is not.
  const { error } = await context.client
    .from("chatbot_unknown_questions")
    .upsert(
      {
        conversation_id: context.conversationId,
        question,
        dedupe_key: dedupeKey,
        last_asked_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: false },
    );

  if (error) {
    // Table not applied yet (this migration ships ahead of being run) — the
    // visitor's turn must not care.
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
