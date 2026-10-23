import "server-only";

import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { sharedResourceMessage } from "@/lib/chatbot/resources";
import {
  openBookingCalendar,
  type ChatbotToolContext,
} from "@/lib/chatbot/tools";

/**
 * What the visitor sees when the model cannot answer (OpenAI down, out of
 * credits, rate limited, empty reply). Never an error or a "glitch": the
 * visitor gets the booking calendar and a free guide, built without OpenAI,
 * so a failed turn still leads somewhere useful.
 */
export const OUTAGE_LINE =
  "Our team member stepped away for a moment. In the meantime, you can grab a time below for a free call with a vending consultant, or take our free 90-Day Roadmap.";

/** True when this transcript has already had a failed turn. */
export function hadOutage(transcript: ChatbotMessage[]): boolean {
  return transcript.some((m) => m.content === OUTAGE_LINE);
}

/**
 * The fallback turn: the line, then the calendar and the roadmap card unless
 * they are already further up the chat. Neither card can throw out of here.
 */
export async function buildOutageMessages(
  context: ChatbotToolContext,
): Promise<ChatbotMessage[]> {
  const prior = [...context.transcript];
  const messages: ChatbotMessage[] = [
    { role: "assistant", content: OUTAGE_LINE, ts: new Date().toISOString() },
  ];

  if (!prior.some((m) => m.kind === "calendar")) {
    try {
      const opened = await openBookingCalendar(context);
      if (opened) messages.push(opened.message);
    } catch (error) {
      console.error("chatbot: outage calendar failed", {
        conversationId: context.conversationId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  if (
    !prior.some((m) => m.kind === "shared_resource" && m.data?.key === "roadmap")
  ) {
    const roadmap = sharedResourceMessage("roadmap", {
      label: "Free resource",
      via: "model",
      emailCaptured: Boolean(context.capturedEmail),
    });
    if (roadmap) messages.push(roadmap);
  }

  return messages;
}
