import "server-only";

import { z } from "zod";
import { formatSlot, localDayAndTime } from "@/lib/chatbot/book-call";
import { directBookingForcedTool } from "@/lib/chatbot/book-call-intent";
import { chatbotBookingUrl } from "@/lib/chatbot/booking";
import {
  resolveBookingCalendar,
  safeTimeZone,
} from "@/lib/chatbot/availability";
import { buildChatbotSystemPrompt } from "@/lib/chatbot/build-system-prompt";
import { loadChatbotConfig } from "@/lib/chatbot/config";
import {
  persistConversationTurn,
  prospectSummaryFrom,
  toChatbotMessages,
  type ChatbotConversation,
  type ChatbotMessage,
} from "@/lib/chatbot/conversation-store";
import { sendResend } from "@/lib/chatbot/emails";
import { extractLead } from "@/lib/chatbot/extract-lead";
import { prospectProfileSchema } from "@/lib/chatbot/extract-prospect-profile";
import {
  chatbotToolDefinitions,
  type ChatbotToolContext,
} from "@/lib/chatbot/tools";
import { createTurnStream } from "@/lib/chatbot/turn-stream";
import {
  trimToBudget,
  userTurnsSinceCalendar,
} from "@/lib/chatbot/turn-helpers";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  conversationFromRecipients,
  htmlToText,
  isAllowedRecipient,
  replyAddress,
  sameMailbox,
  stripQuotedReply,
} from "./address";
import { checkCloseBeforeEmail } from "./close-gate";

/**
 * The email agent: one follow-up to a chat that left an email and no booking,
 * then a real back-and-forth on the replies, booking through the same
 * propose_call_time / book_call checks as the chat.
 *
 * Every send passes, in order: flag on, recipient allowlisted, no booking on
 * the chat, no STOP from them, and the Close check (no opportunity, no booked
 * date, no meeting, no human call/SMS/email in 72h). Any failure = no email.
 */

// ponytail: the chat does not store the visitor's zone, so emails speak
// Pacific and say so. Persist the widget's zone on the conversation when the
// sequence goes beyond the demo.
const DEFAULT_TIME_ZONE = "America/Los_Angeles";
const EMAIL_TOOLS = new Set([
  "get_available_times",
  "propose_call_time",
  "book_call",
  "capture_contact",
  "flag_for_team",
]);

const EMAIL_CHANNEL_SECTION = `EMAIL MODE
You are answering by EMAIL a person who chatted with you on the website earlier and gave their email. Their latest email is the last user message. Write the body of a short reply: two to four plain sentences, no greeting line and no sign-off (both are added for you), no markdown, no links unless a tool gave you one. There is no chat window or calendar card in email, so never mention one. Your goal is to get the free call booked by email: when they name a day or time, propose it; when they say yes to a proposed time, book it. If they want to stop hearing from us, say you will not email again.`;

type AdminClient = ReturnType<typeof createAdminClient>;

export function emailAgentEnabled(): boolean {
  return (
    config.CHATBOT_EMAIL_AGENT === "on" &&
    Boolean(config.CHATBOT_EMAIL_REPLY_SECRET) &&
    Boolean(config.RESEND_API_KEY)
  );
}

function isBooked(
  conversation: ChatbotConversation,
  messages: ChatbotMessage[],
) {
  return (
    Boolean(conversation.call_booked_at) ||
    messages.some((m) => m.kind === "booking_confirmed")
  );
}

function saidStop(messages: ChatbotMessage[]) {
  return messages.some(
    (m) => m.kind === "email_received" && m.data?.stop === true,
  );
}

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function threadTimeZone(messages: ChatbotMessage[]): string {
  const sent = messages.findLast((m) => m.kind === "email_sent");
  const zone = sent?.data?.time_zone;
  return safeTimeZone(typeof zone === "string" ? zone : DEFAULT_TIME_ZONE);
}

/** Up to three openings on different days, daytime first, at least 3h out. */
export function pickOfferSlots(
  slots: readonly string[],
  timeZone: string,
  now: Date,
): string[] {
  const picked: string[] = [];
  const days = new Set<string>();
  const soonest = now.getTime() + 3 * 3_600_000;
  for (const slot of [...slots].sort()) {
    if (Date.parse(slot) < soonest) continue;
    const { day, time } = localDayAndTime(slot, timeZone);
    const hour = Number(time.slice(0, 2));
    if (days.has(day) || hour < 9 || hour > 17) continue;
    days.add(day);
    picked.push(slot);
    if (picked.length === 3) break;
  }
  return picked;
}

function signOff(persona: string) {
  return `${persona}\nVendingpreneurs\n\nReply STOP and I won't email you again.`;
}

async function loadConversation(client: AdminClient, id: string) {
  const { data, error } = await client
    .from("chatbot_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error(`chatbot email agent: load failed: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

export type FollowUpResult =
  | { sent: true; conversationId: string; to: string }
  | { sent: false; conversationId: string; reason: string };

export async function sendFollowUp(
  conversationId: string,
  deps: { client?: AdminClient; now?: () => Date } = {},
): Promise<FollowUpResult> {
  const client = deps.client ?? createAdminClient();
  const now = (deps.now ?? (() => new Date()))();
  const skip = (reason: string): FollowUpResult => ({
    sent: false,
    conversationId,
    reason,
  });

  if (!emailAgentEnabled()) return skip("email agent is off");
  const conversation = await loadConversation(client, conversationId);
  if (!conversation) return skip("no such conversation");
  const email = conversation.captured_email;
  if (!email) return skip("no email on the chat");
  if (!isAllowedRecipient(email, config.CHATBOT_EMAIL_ALLOWLIST)) {
    return skip("recipient not on the allowlist");
  }
  const messages = toChatbotMessages(conversation.messages);
  if (isBooked(conversation, messages)) return skip("already booked");
  if (saidStop(messages)) return skip("they asked us to stop");
  if (messages.some((m) => m.kind === "email_sent")) {
    return skip("follow-up already sent");
  }

  const gate = await checkCloseBeforeEmail({ conversationId, email });
  if (!gate.send) return skip(gate.reason);

  const chatConfig = await loadChatbotConfig();
  const timeZone = DEFAULT_TIME_ZONE;
  const { slots } = await resolveBookingCalendar({ timeZone });
  const offers = pickOfferSlots(slots, timeZone, now);
  const name = firstName(conversation.captured_name);
  const firstQuestion = messages.find((m) => m.role === "user")?.content;
  const topic = firstQuestion
    ? ` You asked "${firstQuestion.slice(0, 120)}${firstQuestion.length > 120 ? "..." : ""}"`
    : "";
  const link = chatbotBookingUrl({
    conversationId,
    name: conversation.captured_name,
    email,
  });

  const body = [
    `Hi${name ? ` ${name}` : ""},`,
    `It's ${chatConfig.personaName} from Vendingpreneurs, from the chat on our site.${topic}, and the best next step is a free call with one of our vending consultants. They'll look at your situation and map out what a first route could look like.`,
    offers.length
      ? `These times are open (Pacific time):\n${offers.map((s) => `- ${formatSlot(s, timeZone)}`).join("\n")}`
      : "",
    `Just reply with the one that works, or any other day and time, and I'll book it for you.${link ? ` If you'd rather pick yourself: ${link}` : ""}`,
    signOff(chatConfig.personaName),
  ]
    .filter(Boolean)
    .join("\n\n");

  const subject = "Your free Vendingpreneurs call";
  const result = await sendResend(
    {
      subject,
      text: body,
      to: [email],
      fromName: `${chatConfig.personaName} at Vendingpreneurs`,
      replyTo: [
        replyAddress(
          conversationId,
          config.CHATBOT_EMAIL_REPLY_SECRET as string,
        ),
      ],
    },
    fetch,
  );
  if (!result.ok) {
    console.error("chatbot email agent: follow-up send failed", {
      conversationId,
      error: result.error,
    });
    return skip("send failed");
  }

  await persistConversationTurn(
    conversation,
    {
      append: [
        {
          role: "assistant",
          content: body,
          ts: now.toISOString(),
          kind: "email_sent",
          data: { subject, time_zone: timeZone, step: "follow_up" },
        },
      ],
    },
    { client },
  );
  return { sent: true, conversationId, to: email };
}

/** Recent chats eligible for a follow-up (allowlisted, emailed nothing yet, quiet for minAgeMinutes). */
export async function followUpCandidates(
  input: { minAgeMinutes: number; limit: number },
  deps: { client?: AdminClient; now?: () => Date } = {},
): Promise<string[]> {
  const client = deps.client ?? createAdminClient();
  const now = (deps.now ?? (() => new Date()))();
  const quietSince = new Date(now.getTime() - input.minAgeMinutes * 60_000);
  const { data, error } = await client
    .from("chatbot_conversations")
    .select("id,captured_email,call_booked_at,messages,last_message_at")
    .not("captured_email", "is", null)
    .is("call_booked_at", null)
    .lte("last_message_at", quietSince.toISOString())
    .gte(
      "last_message_at",
      new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    )
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error)
    throw new Error(`chatbot email agent: candidates: ${error.message}`);
  return (data ?? [])
    .filter((row) =>
      isAllowedRecipient(
        row.captured_email ?? "",
        config.CHATBOT_EMAIL_ALLOWLIST,
      ),
    )
    .filter((row) => {
      const messages = toChatbotMessages(row.messages);
      return (
        !messages.some((m) => m.kind === "email_sent") &&
        !messages.some((m) => m.kind === "booking_confirmed")
      );
    })
    .slice(0, input.limit)
    .map((row) => row.id);
}

// ---------------------------------------------------------------------------
// Inbound reply
// ---------------------------------------------------------------------------

const receivedEmailSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.array(z.string()).default([]),
  subject: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  message_id: z.string().nullable().optional(),
});

export type InboundResult = { handled: boolean; reason: string };

export async function handleInboundEmail(
  emailId: string,
  deps: { client?: AdminClient; fetchImpl?: typeof fetch } = {},
): Promise<InboundResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (!emailAgentEnabled()) return { handled: false, reason: "agent off" };

  const response = await fetchImpl(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}` } },
  );
  if (!response.ok) {
    throw new Error(
      `chatbot email agent: could not read received email (${response.status})`,
    );
  }
  const parsed = receivedEmailSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(
      "chatbot email agent: received email had an unexpected shape",
    );
  }
  const email = parsed.data;

  const conversationId = conversationFromRecipients(
    email.to,
    config.CHATBOT_EMAIL_REPLY_SECRET as string,
  );
  if (!conversationId)
    return { handled: false, reason: "not a signed reply address" };

  const client = deps.client ?? createAdminClient();
  const conversation = await loadConversation(client, conversationId);
  if (!conversation?.captured_email) {
    return { handled: false, reason: "conversation has no email" };
  }
  const sender = (email.from.match(/<([^>]+)>/)?.[1] ?? email.from)
    .trim()
    .toLowerCase();
  if (!sameMailbox(sender, conversation.captured_email)) {
    // Only the person who chatted can drive their own thread.
    return { handled: false, reason: "sender is not the chat's email" };
  }
  const prior = toChatbotMessages(conversation.messages);
  if (
    prior.some(
      (m) => m.kind === "email_received" && m.data?.email_id === email.id,
    )
  ) {
    return { handled: false, reason: "already handled" };
  }

  const text = stripQuotedReply(email.text ?? htmlToText(email.html ?? ""));
  const stop = /^\s*(stop|unsubscribe|remove me)\b/i.test(text);
  const inbound: ChatbotMessage = {
    role: "user",
    content: text || "(empty email)",
    ts: new Date().toISOString(),
    kind: "email_received",
    data: { email_id: email.id, message_id: email.message_id ?? null, stop },
  };
  const record = (append: ChatbotMessage[]) =>
    persistConversationTurn(conversation, { append }, { client });

  if (stop || !text) {
    await record([inbound]);
    return { handled: true, reason: stop ? "stopped" : "empty" };
  }
  if (
    !isAllowedRecipient(sender, config.CHATBOT_EMAIL_ALLOWLIST) &&
    !isAllowedRecipient(
      conversation.captured_email,
      config.CHATBOT_EMAIL_ALLOWLIST,
    )
  ) {
    await record([inbound]);
    return { handled: false, reason: "sender not on the allowlist" };
  }
  if (isBooked(conversation, prior)) {
    await record([inbound]);
    return { handled: false, reason: "already booked; left for the team" };
  }
  const gate = await checkCloseBeforeEmail({ conversationId, email: sender });
  if (!gate.send) {
    await record([inbound]);
    return { handled: false, reason: gate.reason };
  }

  const timeZone = threadTimeZone(prior);
  const turn = await runEmailTurn({
    conversation,
    prior,
    inbound,
    timeZone,
    client,
  });

  const body = composeReply(turn.sink, {
    name: firstName(turn.captured.name),
    persona: turn.persona,
    link: chatbotBookingUrl({
      conversationId,
      name: turn.captured.name,
      email: sender,
    }),
  });
  const subject = email.subject?.match(/^re:/i)
    ? email.subject
    : `Re: ${email.subject ?? "Your free Vendingpreneurs call"}`;
  const result = await sendResend(
    {
      subject,
      text: body,
      to: [sender],
      fromName: `${turn.persona} at Vendingpreneurs`,
      replyTo: [
        replyAddress(
          conversationId,
          config.CHATBOT_EMAIL_REPLY_SECRET as string,
        ),
      ],
      headers: email.message_id
        ? { "In-Reply-To": email.message_id, References: email.message_id }
        : undefined,
    },
    fetchImpl,
  );

  await persistConversationTurn(
    conversation,
    {
      append: [
        inbound,
        ...turn.sink.messages.filter((m) => m.kind),
        {
          role: "assistant",
          content: body,
          ts: new Date().toISOString(),
          kind: "email_sent",
          data: { subject, time_zone: timeZone, step: "reply", ok: result.ok },
        },
      ],
      capturedName: turn.captured.name,
      capturedPhone: turn.captured.phone,
    },
    { client },
  );
  if (!result.ok) {
    throw new Error(`chatbot email agent: reply send failed: ${result.error}`);
  }
  return { handled: true, reason: "replied" };
}

async function runEmailTurn(input: {
  conversation: ChatbotConversation;
  prior: ChatbotMessage[];
  inbound: ChatbotMessage;
  timeZone: string;
  client: AdminClient;
}) {
  const { conversation, prior, inbound, timeZone, client } = input;
  const chatConfig = await loadChatbotConfig();
  const history = [...prior, inbound];
  const extracted = extractLead(inbound.content);
  const captured = {
    name: conversation.captured_name ?? extracted.name,
    email: conversation.captured_email,
    phone: conversation.captured_phone ?? extracted.phone,
  };
  const booked = prior.some((m) => m.kind === "booking_confirmed");

  const system = [
    buildChatbotSystemPrompt({
      personaName: chatConfig.personaName,
      knowledgeBase: chatConfig.knowledgeBase,
      userTurnCount: history.filter((m) => m.role === "user").length,
      capturedName: captured.name,
      capturedEmail: captured.email,
      capturedPhone: captured.phone,
      prospectSummary: prospectSummaryFrom(conversation.prospect_profile),
      hasSeenCalendar: true,
      userTurnsSinceCalendar: userTurnsSinceCalendar(prior),
      hasConfirmedBooking: booked,
      timeZone,
      directBooking: true,
    }),
    EMAIL_CHANNEL_SECTION,
  ].join("\n\n");

  const sink: { messages: ChatbotMessage[] } = { messages: [] };
  const toolContext: ChatbotToolContext = {
    conversationId: conversation.id,
    personaName: chatConfig.personaName,
    capturedName: captured.name,
    capturedEmail: captured.email,
    capturedPhone: captured.phone,
    prospectProfile:
      prospectProfileSchema.safeParse(conversation.prospect_profile).data ??
      null,
    transcript: history,
    embedDomain: null,
    firstPartyEmail: conversation.captured_email,
    // Resource emails are not offered in email mode.
    checkEmailBudget: async () => false,
    config: chatConfig,
    client,
    timeZone,
    valueFirst: false,
    directBooking: true,
    holdCalendar: false,
  };

  const stream = createTurnStream({
    config: chatConfig,
    modelMessages: [
      { role: "system", content: system },
      ...trimToBudget(history).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
    sink,
    captured,
    toolContext,
    forceTool: directBookingForcedTool({
      message: inbound.content,
      priorMessages: prior,
      chosenTool: undefined,
      booked,
    }),
    tools: chatbotToolDefinitions(false, true).filter((t) =>
      EMAIL_TOOLS.has(t.function.name),
    ),
  });
  // The turn persists nothing itself; draining it runs the model and tools.
  const reader = stream.getReader();
  while (!(await reader.read()).done) {
    // drain
  }
  return { sink, captured, persona: chatConfig.personaName };
}

function composeReply(
  sink: { messages: ChatbotMessage[] },
  input: { name: string; persona: string; link: string | null },
): string {
  const replies = sink.messages
    .filter((m) => m.role === "assistant" && !m.kind)
    .map((m) => m.content.trim())
    .filter(Boolean);
  const proposal = sink.messages.findLast((m) => m.kind === "booking_proposed");
  const booked = sink.messages.some((m) => m.kind === "booking_confirmed");
  const calendar = sink.messages.some((m) => m.kind === "calendar");

  const lines = [
    `Hi${input.name ? ` ${input.name}` : ""},`,
    replies.join("\n\n") ||
      "Thanks for the reply. What day and time suits you for the free call?",
    proposal && !booked ? proposal.content : "",
    booked
      ? "Calendly is sending the calendar invite to this address now, with the call details."
      : "",
    calendar && !booked && input.link
      ? `Or pick any open time yourself: ${input.link}`
      : "",
    signOff(input.persona),
  ];
  return lines.filter(Boolean).join("\n\n");
}
