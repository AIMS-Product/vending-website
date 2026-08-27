"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { HandoffEmailReceipt } from "@/lib/chatbot/handoff-email";
import { config as envConfig } from "@/lib/config";
import {
  ChatbotConfigError,
  chatbotLeadRoutingEmails,
  loadChatbotConfigFresh,
  saveChatbotConfig,
  type ChatbotConfigInput,
  type ChatbotQuickAction,
} from "@/lib/chatbot/config";
import {
  runChatbotCatchUpDigest,
  sendProfileEmailForConversation,
} from "@/lib/chatbot/learning/digest";
import { runChatbotLearningPass } from "@/lib/chatbot/learning/run";
import {
  adminCountMissedLeadCatchUp,
  adminHandOffConversation,
  adminSendHandoffEmail,
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
    captureAggressiveness: text(
      "captureAggressiveness",
    ) as ChatbotConfigInput["captureAggressiveness"],
    exitIntentCapture: checked("exitIntentCapture"),
    knowledgeBase: optional("knowledgeBase"),
    model: text("model") || "gpt-4o-mini",
    leadRoutingEmails: optional("leadRoutingEmails"),
    supportEmail: optional("supportEmail"),
    notifyEnabled: checked("notifyEnabled"),
    // Trimmed and filtered here rather than left to zod: the list editors add
    // a blank row for the admin to fill in, and an empty row left behind
    // (never removed) should just drop silently, not fail the whole save.
    starterQuestions: parseJsonArrayField<string>(text("starterQuestions"))
      .map((question) => question.trim())
      .filter(Boolean),
    quickActions: parseJsonArrayField<ChatbotQuickAction>(text("quickActions"))
      .map((action) => ({
        label: action.label?.trim() ?? "",
        url: action.url?.trim() ?? "",
      }))
      .filter((action) => action.label && action.url),
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

  const result = await runChatbotCatchUpDigest(parsed.data.windowDays);
  revalidatePath(ADMIN_CHATBOT_PATH);

  if (!result.eligible) {
    return {
      status: "info",
      message: "No conversations qualify for that window.",
    };
  }
  if (!result.emailed) {
    return {
      status: "error",
      message: `Found ${result.eligible} conversation${result.eligible === 1 ? "" : "s"} but the digest email failed: ${result.emailError ?? "unknown error"}.`,
    };
  }

  const budgetNote = result.timedOut
    ? ` (${result.extractionIncomplete} still need extraction — the time budget ran out, run again to pick them up)`
    : "";
  return {
    status: "saved",
    message: `Sent one digest covering ${result.eligible} conversation${result.eligible === 1 ? "" : "s"} (${result.extracted} freshly extracted, ${result.reusedProfile} reused)${budgetNote}.`,
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
  const { user } = await requireAdmin();
  const parsed = handOffSchema.safeParse({
    conversationId: formData.get("conversationId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  let receipt: HandoffEmailReceipt;
  try {
    receipt = await adminHandOffConversation({
      ...parsed.data,
      actorEmail: user.email ?? "an admin",
    });
  } catch (error) {
    return actionError(error, "Could not hand this conversation off.");
  }

  revalidateConversationPaths(parsed.data.conversationId);
  return receiptState(receipt, "Handed off.");
}

/** The "Resend hand-off email" button: same email, same routing, fresh receipt. */
export async function resendHandoffEmailAction(
  _prev: ChatbotActionState,
  formData: FormData,
): Promise<ChatbotActionState> {
  const { user } = await requireAdmin();
  const parsed = handOffSchema.safeParse({
    conversationId: formData.get("conversationId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }
  const receipt = await adminSendHandoffEmail({
    conversationId: parsed.data.conversationId,
    reason:
      parsed.data.reason || "Handed off from the admin conversation view.",
    actorEmail: user.email ?? "an admin",
  });
  revalidateConversationPaths(parsed.data.conversationId);
  return receiptState(receipt, "");
}

function receiptState(
  receipt: HandoffEmailReceipt,
  prefix: string,
): ChatbotActionState {
  if (receipt.sent) {
    return {
      status: "saved",
      message: `${prefix} Email sent to ${receipt.to.join(", ")}.`.trim(),
    };
  }
  return {
    status: "error",
    message: `${prefix} Email NOT sent: ${receipt.error}`.trim(),
  };
}

/** Drives the "Run learning pass" button on /admin/chatbot/insights. */
export async function runChatbotLearningPassAction(): Promise<ChatbotActionState> {
  await requireAdmin();

  const result = await runChatbotLearningPass();
  revalidatePath("/admin/chatbot/insights");

  if (!result.ok) {
    return {
      status: "error",
      message: result.error ?? "Learning pass failed.",
    };
  }
  return {
    status: "saved",
    message: `Scanned ${result.conversationsScanned} conversations — ${result.cases} cases, ${result.followUpTasks} follow-up tasks, ${result.insights} insights, ${result.knowledgeSuggestions} knowledge fixes, ${result.siteRecommendations} site recommendations.`,
  };
}

/**
 * Parses the JSON-encoded hidden-input value the starter-questions /
 * quick-actions list editors post — malformed JSON (should never happen
 * from the UI itself) falls back to empty rather than 500ing the save,
 * matching parseStatsField's convention in the case-studies admin. The
 * result is untrusted until chatbotConfigInputSchema (inside
 * saveChatbotConfig) validates its actual shape.
 */
function parseJsonArrayField<T>(value: string): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
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
