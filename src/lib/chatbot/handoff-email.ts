import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chatbotLeadRoutingEmails,
  chatbotSupportEmail,
  type ChatbotConfig,
} from "@/lib/chatbot/config";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { sendChatbotHandoffEmail } from "@/lib/chatbot/emails";
import type { Database } from "@/types/database";

/**
 * A hand-off is a promise the bot makes to the visitor: "a teammate will
 * email you". This is the module that keeps it. Every hand-off (the bot's
 * flag_for_team, the admin Hand off button, a manual resend) sends one email
 * with the whole transcript to the right inbox and writes a delivery receipt
 * on the conversation so the admin can see it went, to whom, or why not.
 *
 * Support-reason hand-offs (existing customers: pause, billing, login) go to
 * the support address; everything else goes to the lead-routing recipients.
 */
type HandoffClient = Pick<SupabaseClient<Database>, "from">;

export type HandoffEmailReason =
  "callback" | "support" | "accessibility" | "other" | "manual";

export type HandoffEmailInput = {
  conversationId: string;
  reason: HandoffEmailReason;
  summary: string;
  preferredWindow?: string | null;
  /** Who triggered it, for the email footer. */
  triggeredBy: string;
};

export type HandoffEmailReceipt =
  { sent: true; to: string[]; at: string } | { sent: false; error: string };

type Deps = {
  client: HandoffClient;
  config: ChatbotConfig;
  send?: typeof sendChatbotHandoffEmail;
  now?: () => Date;
};

export function handoffRecipients(
  reason: HandoffEmailReason,
  config: ChatbotConfig,
): string[] {
  const support = chatbotSupportEmail(config);
  if (reason === "support") return [support];
  const routing = chatbotLeadRoutingEmails(config);
  // A sales hand-off with nowhere configured still has to reach a person.
  return routing.length ? routing : [support];
}

export async function emailHandoff(
  input: HandoffEmailInput,
  deps: Deps,
): Promise<HandoffEmailReceipt> {
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const send = deps.send ?? sendChatbotHandoffEmail;

  const { data: row, error } = await deps.client
    .from("chatbot_conversations")
    .select(
      "id, captured_name, captured_email, captured_phone, messages, page_url, created_at",
    )
    .eq("id", input.conversationId)
    .maybeSingle();
  if (error || !row) {
    return await recordFailure(
      deps.client,
      input.conversationId,
      error?.message ?? "Conversation not found.",
    );
  }

  const to = handoffRecipients(input.reason, deps.config);
  const name = row.captured_name?.trim() || "Website chat visitor";
  const subject = `${reasonLabel(input.reason)}: ${name}${
    row.captured_email ? ` (${row.captured_email})` : ""
  }`;
  const text = buildBody({
    name,
    email: row.captured_email,
    phone: row.captured_phone,
    pageUrl: row.page_url,
    startedAt: row.created_at,
    reason: input.reason,
    summary: input.summary,
    preferredWindow: input.preferredWindow ?? null,
    triggeredBy: input.triggeredBy,
    conversationId: row.id,
    messages: Array.isArray(row.messages)
      ? (row.messages as unknown as ChatbotMessage[])
      : [],
  });

  const result = await send({
    to,
    subject,
    text,
    replyTo: row.captured_email ? [row.captured_email] : undefined,
  });

  if (!result.ok) {
    return await recordFailure(deps.client, input.conversationId, result.error);
  }

  const { error: stampError } = await deps.client
    .from("chatbot_conversations")
    .update({
      handoff_emailed_at: now,
      handoff_emailed_to: to.join(", "),
      handoff_email_error: null,
    })
    .eq("id", input.conversationId);
  if (stampError) {
    // The email went; the receipt is what failed. Say so rather than let the
    // admin page imply nobody was told.
    console.warn("chatbot handoff: could not stamp receipt", {
      message: stampError.message,
    });
  }
  return { sent: true, to, at: now };
}

async function recordFailure(
  client: HandoffClient,
  conversationId: string,
  message: string,
): Promise<HandoffEmailReceipt> {
  const { error } = await client
    .from("chatbot_conversations")
    .update({ handoff_email_error: message.slice(0, 500) })
    .eq("id", conversationId);
  if (error) {
    console.warn("chatbot handoff: could not record failure", {
      message: error.message,
    });
  }
  return { sent: false, error: message };
}

function reasonLabel(reason: HandoffEmailReason): string {
  switch (reason) {
    case "support":
      return "Support request from the site chat";
    case "callback":
      return "Callback requested in the site chat";
    case "accessibility":
      return "Accessibility request from the site chat";
    case "manual":
      return "Chat handed off by the team";
    default:
      return "Hand-off from the site chat";
  }
}

export function buildBody(input: {
  name: string;
  email: string | null;
  phone: string | null;
  pageUrl: string | null;
  startedAt: string;
  reason: HandoffEmailReason;
  summary: string;
  preferredWindow: string | null;
  triggeredBy: string;
  conversationId: string;
  messages: ChatbotMessage[];
}): string {
  const transcript = input.messages
    .map((m) => {
      const who = m.role === "user" ? input.name : "Mia";
      return `${who} (${formatTime(m.ts)}):\n${m.content}`;
    })
    .join("\n\n");
  return [
    `${input.summary}`,
    "",
    `Name: ${input.name}`,
    `Email: ${input.email ?? "not given"}`,
    `Phone: ${input.phone ?? "not given"}`,
    input.preferredWindow ? `Preferred time: ${input.preferredWindow}` : null,
    `Chat started: ${formatTime(input.startedAt)}${input.pageUrl ? ` on ${input.pageUrl}` : ""}`,
    "",
    input.email
      ? "Reply to this email and it goes straight to them."
      : "No email on file; use the phone number above.",
    "",
    "----- Full transcript -----",
    transcript || "(no messages recorded)",
    "",
    `Admin view: https://www.vendingpreneurs.com/admin/chatbot/conversations/${input.conversationId}`,
    `Sent by ${input.triggeredBy}.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
