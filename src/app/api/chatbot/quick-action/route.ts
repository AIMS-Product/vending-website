import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { loadChatbotConfig } from "@/lib/chatbot/config";
import { VP_CHAT_VISITOR_COOKIE_NAME } from "@/lib/chatbot/constants";
import {
  loadOrCreateConversation,
  persistConversationTurn,
  toChatbotMessages,
} from "@/lib/chatbot/conversation-store";
import { isUnderChatbotDailyCap } from "@/lib/chatbot/input-budget";
import { quickActionTurn } from "@/lib/chatbot/quick-action-turn";
import { quickActionBehavior } from "@/lib/chatbot/quick-actions";
import { publicConfig } from "@/lib/config";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A widget quick action that stays in the chat: "Book a call" opens the
 * conversation-tagged calendar (so the booking is credited to the chat, which
 * the old /book-now link never was) and "Free 90-day roadmap" shows the
 * delivered roadmap as a card. The message is stored on the transcript with
 * `data.via = "quick_action"`, which is what the dashboard counts.
 *
 * The browser sends only the action's URL; the label and the behaviour come
 * from the saved config, so nothing the visitor controls is written into the
 * transcript. Same `sessionId` trust model as /api/chatbot/chat.
 */
const requestSchema = z.object({
  sessionId: z.string().trim().min(8).max(200),
  url: z.string().trim().min(1).max(500),
  pageUrl: z.string().trim().max(2000).nullable().optional(),
  timeZone: z.string().trim().max(64).nullable().optional(),
});

export async function POST(request: Request) {
  const config = await loadChatbotConfig();
  if (!config.enabled) {
    return Response.json({ message: "Not found." }, { status: 404 });
  }

  const ip = requestIp(request.headers);
  if (!(await checkPublicRateLimit("chatbot_quick_action", { ip }))) {
    return Response.json(
      { message: TOO_MANY_REQUESTS_MESSAGE },
      { status: 429 },
    );
  }

  const parsed = requestSchema.safeParse(await safeJson(request));
  if (!parsed.success) {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }
  const { sessionId, url, pageUrl, timeZone } = parsed.data;

  const action = config.quickActions.find((entry) => entry.url === url);
  const behavior = action ? quickActionBehavior(action.url) : null;
  if (!action || !behavior || behavior.type === "link") {
    return Response.json({ message: "Not found." }, { status: 404 });
  }

  const client = createAdminClient();

  // Creating a conversation spends the same budgets a first chat turn does.
  const { data: existing } = await client
    .from("chatbot_conversations")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!existing) {
    const allowed =
      (await isUnderChatbotDailyCap()) &&
      (await checkPublicRateLimit("chatbot_new_conversation", { ip }));
    if (!allowed) {
      return Response.json(
        { message: TOO_MANY_REQUESTS_MESSAGE },
        { status: 429 },
      );
    }
  }

  const visitorId =
    (await cookies()).get(VP_CHAT_VISITOR_COOKIE_NAME)?.value ?? null;
  const visitorHash = visitorId
    ? createHash("sha256").update(visitorId).digest("hex")
    : null;

  try {
    const conversation = await loadOrCreateConversation(
      {
        sessionId,
        pageUrl: pageUrl ?? null,
        userAgent: request.headers.get("user-agent"),
        visitorHash,
      },
      { client },
    );
    const transcript = toChatbotMessages(conversation.messages);
    const turn = await quickActionTurn({
      behavior,
      label: action.label,
      conversation,
      transcript,
      embedDomain: siteHostname(),
      timeZone: timeZone ?? null,
    });
    if (!turn) {
      return Response.json({ message: "Unavailable." }, { status: 503 });
    }

    // ponytail: whole-array write, like every chat turn. The widget disables
    // quick actions while a reply is streaming, which is the only overlap a
    // real visitor can produce; a per-message append RPC would close it fully.
    if (turn.append) {
      await persistConversationTurn(
        conversation,
        { messages: [...transcript, turn.message], pageUrl: pageUrl ?? null },
        { client },
      );
    }

    const { role, content, kind, data } = turn.message;
    return Response.json(
      {
        message: { role, content, kind, data: data ?? null },
        appended: turn.append,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("chatbot quick action failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return Response.json({ message: "Unavailable." }, { status: 500 });
  }
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Calendly requires the embedding page's domain on an inline embed. */
function siteHostname(): string | null {
  try {
    return new URL(publicConfig.siteUrl).hostname;
  } catch {
    return null;
  }
}
