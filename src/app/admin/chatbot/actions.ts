"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { config as envConfig } from "@/lib/config";
import {
  ChatbotConfigError,
  chatbotLeadRoutingEmails,
  loadChatbotConfigFresh,
  saveChatbotConfig,
  type ChatbotConfigInput,
} from "@/lib/chatbot/config";
import {
  adminCountMissedLeadCatchUp,
  adminHandOffConversation,
  adminSaveConversationNote,
  adminToggleConversationFlag,
  ChatbotAdminError,
  isChatbotFlag,
} from "@/lib/services/chatbot-admin";
import { requireAdmin } from "@/lib/supabase/auth";
import { attributableUserId } from "@/lib/supabase/dev-auth";

export type ChatbotActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "info"; message: string }
  | { status: "error"; message: string };

const ADMIN_CHATBOT_PATH = "/admin/chatbot";

const conversationIdSchema = z.uuid("Invalid conversation id.");

export async function saveChatbotConfigAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const optional = (name: string) => text(name) || null;
  const checked = (name: string) => formData.get(name) !== null;
  const idleTriggerSeconds = Number(text("idleTriggerSeconds") || "0");

  const input: ChatbotConfigInput = {
    enabled: checked("enabled"),
    personaName: text("personaName"),
    avatarUrl: optional("avatarUrl"),
    greeting: optional("greeting"),
    followUpMessage: optional("followUpMessage"),
    teaserText: optional("teaserText"),
    brandColor: optional("brandColor"),
    idleTriggerSeconds: Number.isFinite(idleTriggerSeconds)
      ? idleTriggerSeconds
      : 5,
    captureMode: text("captureMode") as ChatbotConfigInput["captureMode"],
    knowledgeBase: optional("knowledgeBase"),
    model: text("model") || "gpt-4o-mini",
    leadRoutingEmails: optional("leadRoutingEmails"),
    notifyEnabled: checked("notifyEnabled"),
  };

  try {
    await saveChatbotConfig(input);
  } catch (error) {
    return actionError(error, "Could not save chatbot settings.");
  }

  revalidatePath(ADMIN_CHATBOT_PATH);
  return {
    status: "saved",
    message: input.enabled
      ? "Saved. The chatbot is live for visitors."
      : "Saved. The chatbot is off.",
  };
}

// useActionState always calls with (prevState, formData); neither is used
// here, and TS permits a narrower-arity function wherever the wider one is
// expected, so the unused params are simply omitted rather than flagged.
export async function sendChatbotTestEmailAction(): Promise<ChatbotActionState> {
  const { user } = await requireAdmin();

  const config = await loadChatbotConfigFresh();
  const recipients = chatbotLeadRoutingEmails(config);
  if (!recipients.length) {
    return {
      status: "error",
      message:
        "No routing recipients yet — add one or more emails above and save first.",
    };
  }
  if (!envConfig.RESEND_API_KEY || !envConfig.LEAD_NOTIFICATION_FROM) {
    return {
      status: "error",
      message: "Resend isn't configured on this environment.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envConfig.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: envConfig.LEAD_NOTIFICATION_FROM,
        to: recipients,
        subject: "Site chatbot — test email",
        text: [
          "This confirms chatbot lead routing is wired up correctly.",
          `Recipients: ${recipients.join(", ")}`,
          `Sent by ${user.email} from /admin/chatbot.`,
        ].join("\n\n"),
      }),
    });

    if (!response.ok) {
      const body = await safeResponseText(response);
      return {
        status: "error",
        message: `Resend rejected the test email (${response.status})${body ? `: ${body}` : ""}.`,
      };
    }
  } catch {
    return { status: "error", message: "The test email request failed." };
  }

  return {
    status: "saved",
    message: `Test email sent to ${recipients.join(", ")}.`,
  };
}

const catchUpSchema = z.object({
  windowDays: z.coerce
    .number()
    .int()
    .refine((n) => [7, 30, 90].includes(n), {
      message: "Pick a 7, 30, or 90 day window.",
    }),
});

/** Read-only RPC the routing panel calls as the window picker changes, so the
 *  eligible count updates before the admin commits to sending anything. */
export async function getChatbotCatchUpEligibleCountAction(
  windowDays: number,
): Promise<number> {
  await requireAdmin();
  const parsed = catchUpSchema.safeParse({ windowDays });
  if (!parsed.success) return 0;
  return adminCountMissedLeadCatchUp(parsed.data.windowDays);
}

/** Ships with the Phase 4 learning loop (deterministic engine + digest
 *  email). The window/count UI is real; the send itself is intentionally a
 *  stub so it never silently no-ops without telling the admin why. */
export async function sendChatbotCatchUpDigestAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = catchUpSchema.safeParse({
    windowDays: formData.get("windowDays"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  const eligible = await adminCountMissedLeadCatchUp(parsed.data.windowDays);
  return {
    status: "info",
    message:
      eligible > 0
        ? `Catch-up digests aren't enabled yet — ${eligible} conversation${eligible === 1 ? "" : "s"} would qualify once the learning loop ships.`
        : "Catch-up digests aren't enabled yet.",
  };
}

const toggleFlagSchema = z.object({
  conversationId: conversationIdSchema,
  flag: z.string().refine(isChatbotFlag, "Unknown flag."),
});

export async function toggleConversationFlagAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const { user } = await requireAdmin();
  const parsed = toggleFlagSchema.safeParse({
    conversationId: formData.get("conversationId"),
    flag: formData.get("flag"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  try {
    await adminToggleConversationFlag({
      conversationId: parsed.data.conversationId,
      flag: parsed.data.flag,
      actorId: attributableUserId(user.id),
    });
  } catch (error) {
    return actionError(error, "Could not update this flag.");
  }

  revalidateConversationPaths(parsed.data.conversationId);
  return { status: "saved", message: "Flag updated." };
}

const saveNoteSchema = z.object({
  conversationId: conversationIdSchema,
  note: z.string().trim().max(4000),
});

export async function saveConversationNoteAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = saveNoteSchema.safeParse({
    conversationId: formData.get("conversationId"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  try {
    await adminSaveConversationNote(parsed.data);
  } catch (error) {
    return actionError(error, "Could not save this note.");
  }

  revalidateConversationPaths(parsed.data.conversationId);
  return { status: "saved", message: "Note saved." };
}

const handOffSchema = z.object({
  conversationId: conversationIdSchema,
  reason: z.string().trim().max(2000),
});

export async function handOffConversationAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  await requireAdmin();
  const parsed = handOffSchema.safeParse({
    conversationId: formData.get("conversationId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  try {
    await adminHandOffConversation(parsed.data);
  } catch (error) {
    return actionError(error, "Could not hand this conversation off.");
  }

  revalidateConversationPaths(parsed.data.conversationId);
  return {
    status: "saved",
    message: "Marked as handed off. The team notification ships with Phase 4.",
  };
}

function revalidateConversationPaths(conversationId: string) {
  revalidatePath(`/admin/chatbot/conversations/${conversationId}`);
  revalidatePath("/admin/chatbot/conversations");
}

function actionError(error: unknown, fallback: string): ChatbotActionState {
  if (
    error instanceof ChatbotConfigError ||
    error instanceof ChatbotAdminError
  ) {
    return { status: "error", message: error.message };
  }
  console.error("chatbot admin action failed", error);
  return { status: "error", message: fallback };
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}
