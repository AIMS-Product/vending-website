import "server-only";

import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import type { QuickActionBehavior } from "@/lib/chatbot/quick-actions";
import { sharedResourceMessage } from "@/lib/chatbot/resources";
import { openBookingCalendar } from "@/lib/chatbot/tools";

type InChatBehavior = Exclude<QuickActionBehavior, { type: "link" }>;

type Deps = {
  openCalendar?: (
    input: Parameters<typeof openBookingCalendar>[0],
  ) => Promise<{ message: ChatbotMessage } | null>;
};

/**
 * The message a widget quick action puts into the chat. `append: false` means
 * the same card is already the last thing on screen, so the click adds nothing
 * (a second identical calendar under the first looks broken).
 */
export async function quickActionTurn(
  input: {
    behavior: InChatBehavior;
    label: string;
    conversation: {
      id: string;
      captured_name: string | null;
      captured_email: string | null;
    };
    transcript: readonly ChatbotMessage[];
    embedDomain: string | null;
    timeZone?: string | null;
  },
  deps: Deps = {},
): Promise<{ message: ChatbotMessage; append: boolean } | null> {
  const last = input.transcript.at(-1);

  if (input.behavior.type === "calendar") {
    if (last?.kind === "calendar") return { message: last, append: false };
    const openCalendar = deps.openCalendar ?? openBookingCalendar;
    const opened = await openCalendar({
      conversationId: input.conversation.id,
      capturedName: input.conversation.captured_name,
      capturedEmail: input.conversation.captured_email,
      embedDomain: input.embedDomain,
      timeZone: input.timeZone ?? null,
      via: "quick_action",
    });
    return opened ? { message: opened.message, append: true } : null;
  }

  const key = input.behavior.key;
  if (last?.kind === "shared_resource" && last.data?.key === key) {
    return { message: last, append: false };
  }
  const message = sharedResourceMessage(key, {
    label: input.label,
    via: "quick_action",
  });
  return message ? { message, append: true } : null;
}
