import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  escapeHtml,
  resolveCloseLeadId,
  writeLeadNoteOnce,
} from "@/lib/chatbot/close-note";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Puts a chatbot hand-off (callback wanted, existing-member support,
 * accessibility, broken calendar) in front of the rep who owns the lead.
 *
 * flag_for_team writes a `chatbot_follow_up_tasks` row nobody on the sales
 * team looks at. Their working surface is Close: the L2 lists and the task
 * inbox. So each open hand-off becomes one Close note (visible on the lead,
 * de-duplicated by marker) plus one Close task dated today, which lands in
 * the lead owner's task list. The task is only created when the note was
 * newly written, so a re-run never doubles it.
 *
 * Runs twice per hand-off: once from the tool (works when the Close lead
 * already exists) and once from the Close sync drain right after the lead is
 * created (covers a hand-off captured in the same conversation that created
 * the lead). Whichever runs second finds the note and stops.
 */

type HandoffClient = Pick<SupabaseClient<Database>, "from">;

export type WriteChatbotHandoffsInput = {
  conversationId?: string;
  /** Alternative entry from the sync drain, which knows the lead but not the chat. */
  leadSubmissionId?: string;
  closeLeadId?: string | null;
};

export type ChatbotHandoffResult = {
  sent: number;
  skipped: number;
};

export const HANDOFF_DEDUPE_PREFIX = "flag_for_team:";

export async function writeChatbotHandoffsToClose(
  input: WriteChatbotHandoffsInput,
  deps: { client?: HandoffClient; closeClient?: CloseClient } = {},
): Promise<ChatbotHandoffResult> {
  const none = { sent: 0, skipped: 0 };
  if (!config.CLOSE_API_KEY) return none;
  const client = deps.client ?? createAdminClient();

  try {
    const conversationId =
      input.conversationId ??
      (input.leadSubmissionId
        ? await conversationIdForLead(client, input.leadSubmissionId)
        : null);
    if (!conversationId) return none;

    const { data: tasks, error } = await client
      .from("chatbot_follow_up_tasks")
      .select("id,reason_summary,dedupe_key,created_at")
      .eq("conversation_id", conversationId)
      .eq("status", "open")
      .like("dedupe_key", `${HANDOFF_DEDUPE_PREFIX}%`);
    if (error || !tasks?.length) return none;

    const leadId =
      input.closeLeadId ?? (await resolveCloseLeadId(client, conversationId));
    if (!leadId) return { sent: 0, skipped: tasks.length };

    const closeClient =
      deps.closeClient ??
      createCloseClient({
        apiKey: config.CLOSE_API_KEY,
        baseUrl: config.CLOSE_API_BASE_URL,
      });

    let sent = 0;
    for (const task of tasks) {
      const marker = `chatbot-handoff:${task.id}`;
      const result = await writeLeadNoteOnce(
        {
          conversationId,
          closeLeadId: leadId,
          marker,
          buildHtml: (m) => handoffNoteHtml(task.reason_summary, m),
        },
        { client, closeClient },
      );
      if (result === "written") {
        await closeClient.createTask({
          _type: "lead",
          lead_id: leadId,
          text: taskText(task.reason_summary),
          date: new Date().toISOString().slice(0, 10),
        });
      }
      if (result === "written" || result === "duplicate") {
        await client
          .from("chatbot_follow_up_tasks")
          .update({ status: "sent" })
          .eq("id", task.id);
        sent += 1;
      }
    }
    return { sent, skipped: tasks.length - sent };
  } catch (error) {
    console.warn("chatbot: could not push hand-off to Close", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return none;
  }
}

async function conversationIdForLead(
  client: HandoffClient,
  leadSubmissionId: string,
): Promise<string | null> {
  const { data } = await client
    .from("chatbot_conversations")
    .select("id")
    .eq("lead_submission_id", leadSubmissionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** "[callback] wants Thursday evening · Phone: 555" -> a one-line task. */
export function taskText(reasonSummary: string): string {
  const reason = reasonSummary.match(/^\[(\w+)\]/)?.[1] ?? "handoff";
  const label =
    reason === "callback"
      ? "Chatbot callback requested"
      : reason === "support"
        ? "Chatbot: existing member needs support"
        : reason === "accessibility"
          ? "Chatbot: continue by text or email (no phone call)"
          : "Chatbot hand-off";
  const body = reasonSummary.replace(/^\[\w+\]\s*/, "");
  return `${label}: ${body}`.slice(0, 1000);
}

function handoffNoteHtml(reasonSummary: string, marker: string): string {
  return [
    `<p><strong>Website chat hand-off</strong></p>`,
    `<p>${escapeHtml(reasonSummary)}</p>`,
    `<p>The full transcript is on the lead's engagement note and in the site admin.</p>`,
    `<p style="color:#888;font-size:11px">${escapeHtml(marker)}</p>`,
  ].join("");
}
