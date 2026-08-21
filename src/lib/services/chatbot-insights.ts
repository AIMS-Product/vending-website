import "server-only";

import { revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHATBOT_CONFIG_CACHE_TAG } from "@/lib/chatbot/config";
import { ChatbotAdminError } from "@/lib/services/chatbot-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Read/write surface for /admin/chatbot/insights — the learning loop's
 * output tables (chatbot_learning_cases, chatbot_follow_up_tasks,
 * chatbot_insights, chatbot_knowledge_suggestions,
 * chatbot_site_recommendations). Mirrors the query/deps conventions in
 * chatbot-admin.ts (two-query joins over admin client reads, ChatbotAdminError
 * for anything the UI needs to surface as a message).
 */

type Client = Pick<SupabaseClient<Database>, "from">;
type ServiceDeps = { client?: Client; now?: () => Date };

export type AdminChatbotRange = 7 | 30 | 90;

function windowStart(range: AdminChatbotRange, now: Date): string {
  return new Date(now.getTime() - range * 24 * 3_600_000).toISOString();
}

export type ChatbotInsightsKpis = {
  conversations: number;
  captureRate: number;
  avgMessages: number;
  needsPromptTuningCount: number;
  followUpTasksReadyCount: number;
  followUpTasksDueTodayCount: number;
  insightsCount: number;
  knowledgeFixesCount: number;
  siteRecsCount: number;
  unansweredQuestionsCount: number;
  lastLearningRun: {
    startedAt: string;
    finishedAt: string | null;
    ok: boolean | null;
    conversationsScanned: number;
    recordsWritten: number;
    error: string | null;
  } | null;
};

export async function getChatbotInsightsKpis(
  range: AdminChatbotRange,
  deps: ServiceDeps = {},
): Promise<ChatbotInsightsKpis> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();
  const start = windowStart(range, now);
  const endOfToday = endOfTodayIso(now);

  const [
    conversationStats,
    needsPromptTuningCount,
    followUpTasksReady,
    insightsCount,
    knowledgeFixesCount,
    siteRecsCount,
    unansweredQuestionsCount,
    lastLearningRun,
  ] = await Promise.all([
    fetchConversationStats(client, start),
    countFlags(client, "needs_prompt_tuning", start),
    fetchOpenFollowUpTasks(client, start),
    countOpen(client, "chatbot_insights", start),
    countOpen(client, "chatbot_knowledge_suggestions", start),
    countOpen(client, "chatbot_site_recommendations", start),
    countUnansweredQuestions(client, start),
    fetchLastLearningRun(client),
  ]);

  return {
    conversations: conversationStats.count,
    captureRate: conversationStats.count
      ? conversationStats.captured / conversationStats.count
      : 0,
    avgMessages: conversationStats.count
      ? conversationStats.totalMessages / conversationStats.count
      : 0,
    needsPromptTuningCount,
    followUpTasksReadyCount: followUpTasksReady.length,
    followUpTasksDueTodayCount: followUpTasksReady.filter(
      (t) => t.due_at !== null && t.due_at <= endOfToday,
    ).length,
    insightsCount,
    knowledgeFixesCount,
    siteRecsCount,
    unansweredQuestionsCount,
    lastLearningRun,
  };
}

/** Its own counter rather than countOpen(): the table ships ahead of its migration and must fail soft to 0, not throw the page. */
async function countUnansweredQuestions(
  client: Client,
  start: string,
): Promise<number> {
  const { count, error } = await client
    .from("chatbot_unknown_questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gte("last_asked_at", start);
  if (error) return 0;
  return count ?? 0;
}

async function fetchConversationStats(client: Client, start: string) {
  const { data, error } = await client
    .from("chatbot_conversations")
    .select("captured_email, captured_phone, message_count")
    .gte("created_at", start);
  if (error) throw new ChatbotAdminError("Could not load conversation stats.");
  const rows = data ?? [];
  return {
    count: rows.length,
    captured: rows.filter((r) => r.captured_email || r.captured_phone).length,
    totalMessages: rows.reduce((sum, r) => sum + (r.message_count ?? 0), 0),
  };
}

async function countFlags(
  client: Client,
  flag: string,
  start: string,
): Promise<number> {
  const { count, error } = await client
    .from("chatbot_conversation_flags")
    .select("id", { count: "exact", head: true })
    .eq("flag", flag)
    .gte("created_at", start);
  if (error) throw new ChatbotAdminError("Could not load flag counts.");
  return count ?? 0;
}

async function fetchOpenFollowUpTasks(client: Client, start: string) {
  const { data, error } = await client
    .from("chatbot_follow_up_tasks")
    .select("id, due_at")
    .eq("status", "open")
    .gte("created_at", start);
  if (error) throw new ChatbotAdminError("Could not load follow-up tasks.");
  return data ?? [];
}

async function countOpen(
  client: Client,
  table:
    | "chatbot_insights"
    | "chatbot_knowledge_suggestions"
    | "chatbot_site_recommendations",
  start: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gte("created_at", start);
  if (error) throw new ChatbotAdminError(`Could not load ${table}.`);
  return count ?? 0;
}

async function fetchLastLearningRun(client: Client) {
  const { data, error } = await client
    .from("chatbot_learning_runs")
    .select(
      "started_at, finished_at, ok, conversations_scanned, records_written, error",
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new ChatbotAdminError("Could not load the last learning run.");
  if (!data) return null;
  return {
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    ok: data.ok,
    conversationsScanned: data.conversations_scanned,
    recordsWritten: data.records_written,
    error: data.error,
  };
}

function endOfTodayIso(now: Date): string {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

// --- Conversation label lookup (shared by every list below) ---------------

async function conversationLabels(
  client: Client,
  conversationIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(conversationIds)];
  const labels = new Map<string, string>();
  if (!ids.length) return labels;

  const { data, error } = await client
    .from("chatbot_conversations")
    .select("id, captured_name, captured_email, captured_phone")
    .in("id", ids);
  if (error)
    throw new ChatbotAdminError("Could not load conversation details.");

  for (const row of data ?? []) {
    labels.set(
      row.id,
      row.captured_name ||
        row.captured_email ||
        row.captured_phone ||
        "Anonymous visitor",
    );
  }
  return labels;
}

// --- Follow-up tasks --------------------------------------------------

export type AdminFollowUpTask = {
  id: string;
  conversationId: string | null;
  conversationLabel: string;
  taskType: string;
  priority: number;
  draftSubject: string | null;
  draftBody: string | null;
  dueAt: string | null;
  reasonSummary: string;
  createdAt: string;
};

export async function listOpenFollowUpTasks(
  range: AdminChatbotRange,
  deps: ServiceDeps = {},
): Promise<AdminFollowUpTask[]> {
  const client = deps.client ?? createAdminClient();
  const start = windowStart(range, deps.now?.() ?? new Date());

  const { data, error } = await client
    .from("chatbot_follow_up_tasks")
    .select(
      "id, conversation_id, task_type, priority, draft_subject, draft_body, due_at, reason_summary, created_at",
    )
    .eq("status", "open")
    .gte("created_at", start)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new ChatbotAdminError("Could not load follow-up tasks.");

  const rows = data ?? [];
  const labels = await conversationLabels(
    client,
    rows
      .map((r) => r.conversation_id)
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    conversationLabel: row.conversation_id
      ? (labels.get(row.conversation_id) ?? "Anonymous visitor")
      : "Anonymous visitor",
    taskType: row.task_type,
    priority: row.priority,
    draftSubject: row.draft_subject,
    draftBody: row.draft_body,
    dueAt: row.due_at,
    reasonSummary: row.reason_summary,
    createdAt: row.created_at,
  }));
}

export async function markFollowUpTaskSent(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_follow_up_tasks",
    id,
    {
      status: "sent",
    },
  );
}

export async function dismissFollowUpTask(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_follow_up_tasks",
    id,
    {
      status: "dismissed",
    },
  );
}

// --- Objections & gaps (learning cases) --------------------------------

export type AdminLearningCase = {
  id: string;
  conversationId: string | null;
  conversationLabel: string;
  caseType: string;
  confidence: number;
  reasonSummary: string;
  createdAt: string;
};

export async function listOpenLearningCases(
  range: AdminChatbotRange,
  deps: ServiceDeps = {},
): Promise<AdminLearningCase[]> {
  const client = deps.client ?? createAdminClient();
  const start = windowStart(range, deps.now?.() ?? new Date());

  const { data, error } = await client
    .from("chatbot_learning_cases")
    .select(
      "id, conversation_id, case_type, confidence, reason_summary, created_at",
    )
    .eq("status", "open")
    .gte("created_at", start)
    .order("created_at", { ascending: false });
  if (error) throw new ChatbotAdminError("Could not load objections and gaps.");

  const rows = data ?? [];
  const labels = await conversationLabels(
    client,
    rows
      .map((r) => r.conversation_id)
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    conversationLabel: row.conversation_id
      ? (labels.get(row.conversation_id) ?? "Anonymous visitor")
      : "Anonymous visitor",
    caseType: row.case_type,
    confidence: row.confidence,
    reasonSummary: row.reason_summary,
    createdAt: row.created_at,
  }));
}

export async function markLearningCaseReviewed(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_learning_cases",
    id,
    {
      status: "resolved",
      resolved_at: now.toISOString(),
    },
  );
}

export async function dismissLearningCase(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_learning_cases",
    id,
    {
      status: "dismissed",
      resolved_at: now.toISOString(),
    },
  );
}

// --- Knowledge fixes -----------------------------------------------------

export type AdminKnowledgeSuggestion = {
  id: string;
  patternType: string;
  affectedCount: number;
  suggestedText: string;
  createdAt: string;
};

export async function listOpenKnowledgeSuggestions(
  range: AdminChatbotRange,
  deps: ServiceDeps = {},
): Promise<AdminKnowledgeSuggestion[]> {
  const client = deps.client ?? createAdminClient();
  const start = windowStart(range, deps.now?.() ?? new Date());

  const { data, error } = await client
    .from("chatbot_knowledge_suggestions")
    .select("id, pattern_type, affected_count, suggested_text, created_at")
    .eq("status", "open")
    .gte("created_at", start)
    .order("affected_count", { ascending: false });
  if (error) throw new ChatbotAdminError("Could not load knowledge fixes.");

  return (data ?? []).map((row) => ({
    id: row.id,
    patternType: row.pattern_type,
    affectedCount: row.affected_count,
    suggestedText: row.suggested_text,
    createdAt: row.created_at,
  }));
}

/** Appends the suggested text straight onto chatbot_config.knowledge_base
 *  (id=1) and marks the suggestion applied. Bypasses saveChatbotConfig's
 *  full-form validation on purpose — this only ever touches one column —
 *  but still revalidates the same cache tag so the widget picks it up on
 *  its next request without waiting out the 60s cache. */
export async function applyKnowledgeSuggestion(
  id: string,
  deps: ServiceDeps = {},
): Promise<{ knowledgeBase: string }> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();

  const { data: suggestion, error: suggestionError } = await client
    .from("chatbot_knowledge_suggestions")
    .select("suggested_text")
    .eq("id", id)
    .maybeSingle();
  if (suggestionError || !suggestion) {
    throw new ChatbotAdminError("Could not load this knowledge fix.");
  }

  const { data: configRow, error: configError } = await client
    .from("chatbot_config")
    .select("knowledge_base")
    .eq("id", 1)
    .maybeSingle();
  if (configError)
    throw new ChatbotAdminError("Could not load the chatbot config.");

  const existing = configRow?.knowledge_base?.trim();
  const knowledgeBase = existing
    ? `${existing}\n\n${suggestion.suggested_text}`
    : suggestion.suggested_text;

  const { error: updateError } = await client
    .from("chatbot_config")
    .update({ knowledge_base: knowledgeBase, updated_at: now.toISOString() })
    .eq("id", 1);
  if (updateError)
    throw new ChatbotAdminError("Could not update the knowledge base.");

  await updateStatus(client, "chatbot_knowledge_suggestions", id, {
    status: "applied",
    applied_at: now.toISOString(),
  });

  revalidateTag(CHATBOT_CONFIG_CACHE_TAG, "max");
  return { knowledgeBase };
}

export async function dismissKnowledgeSuggestion(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_knowledge_suggestions",
    id,
    {
      status: "dismissed",
    },
  );
}

// --- Unanswered questions -------------------------------------------------

export type AdminUnknownQuestion = {
  id: string;
  question: string;
  askCount: number;
  conversationId: string | null;
  lastAskedAt: string;
};

/**
 * Questions the model itself reported it could not answer (the
 * flag_unknown_question tool). Unlike everything else on this page these are
 * first-person gaps rather than inferred ones, which is what makes them the
 * highest-signal thing to fix.
 *
 * Returns [] when the table does not exist yet — this ships ahead of its
 * migration, and a missing table must degrade to an empty rail rather than
 * failing the whole insights page.
 */
export async function listOpenUnknownQuestions(
  range: AdminChatbotRange,
  deps: ServiceDeps = {},
): Promise<AdminUnknownQuestion[]> {
  const client = deps.client ?? createAdminClient();
  const start = windowStart(range, deps.now?.() ?? new Date());

  const { data, error } = await client
    .from("chatbot_unknown_questions")
    .select("id, question, ask_count, conversation_id, last_asked_at")
    .eq("status", "open")
    .gte("last_asked_at", start)
    .order("ask_count", { ascending: false })
    .order("last_asked_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("chatbot: unanswered questions unavailable", {
      error: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    question: row.question,
    askCount: row.ask_count ?? 1,
    conversationId: row.conversation_id,
    lastAskedAt: row.last_asked_at,
  }));
}

/**
 * The self-learning loop closing: an admin's answer is appended to the same
 * knowledge base the system prompt reads, so the next visitor who asks gets
 * the real answer instead of another "the team will follow up".
 */
export async function answerUnknownQuestion(
  id: string,
  answer: string,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now?.() ?? new Date();

  const trimmedAnswer = answer.trim();
  if (!trimmedAnswer) {
    throw new ChatbotAdminError("Write an answer before adding it.");
  }

  const { data: row, error: rowError } = await client
    .from("chatbot_unknown_questions")
    .select("question")
    .eq("id", id)
    .maybeSingle();
  if (rowError || !row) {
    throw new ChatbotAdminError("Could not load this question.");
  }

  const { data: configRow, error: configError } = await client
    .from("chatbot_config")
    .select("knowledge_base")
    .eq("id", 1)
    .maybeSingle();
  if (configError) {
    throw new ChatbotAdminError("Could not load the chatbot config.");
  }

  const entry = `Q: ${row.question}\nA: ${trimmedAnswer}`;
  const existing = configRow?.knowledge_base?.trim();
  const knowledgeBase = existing ? `${existing}\n\n${entry}` : entry;

  const { error: updateError } = await client
    .from("chatbot_config")
    .update({ knowledge_base: knowledgeBase, updated_at: now.toISOString() })
    .eq("id", 1);
  if (updateError) {
    throw new ChatbotAdminError("Could not update the knowledge base.");
  }

  const { error: statusError } = await client
    .from("chatbot_unknown_questions")
    .update({
      status: "answered",
      answer: trimmedAnswer,
      answered_at: now.toISOString(),
    })
    .eq("id", id);
  if (statusError) {
    // The knowledge base already has the answer, which is the part that
    // matters; the row just stays on the rail until someone dismisses it.
    console.warn("chatbot: could not mark question answered", {
      id,
      error: statusError.message,
    });
  }

  revalidateTag(CHATBOT_CONFIG_CACHE_TAG, "max");
}

export async function dismissUnknownQuestion(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = deps.client ?? createAdminClient();
  const { error } = await client
    .from("chatbot_unknown_questions")
    .update({ status: "dismissed" })
    .eq("id", id);
  if (error) throw new ChatbotAdminError("Could not dismiss this question.");
}

// --- Site recommendations -------------------------------------------------

export type AdminSiteRecommendation = {
  id: string;
  recommendationType: string;
  suggestedTitle: string;
  suggestedBody: string;
  createdAt: string;
};

export async function listOpenSiteRecommendations(
  range: AdminChatbotRange,
  deps: ServiceDeps = {},
): Promise<AdminSiteRecommendation[]> {
  const client = deps.client ?? createAdminClient();
  const start = windowStart(range, deps.now?.() ?? new Date());

  const { data, error } = await client
    .from("chatbot_site_recommendations")
    .select(
      "id, recommendation_type, suggested_title, suggested_body, created_at",
    )
    .eq("status", "open")
    .gte("created_at", start)
    .order("created_at", { ascending: false });
  if (error)
    throw new ChatbotAdminError("Could not load site recommendations.");

  return (data ?? []).map((row) => ({
    id: row.id,
    recommendationType: row.recommendation_type,
    suggestedTitle: row.suggested_title,
    suggestedBody: row.suggested_body,
    createdAt: row.created_at,
  }));
}

export async function markSiteRecommendationPlanned(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_site_recommendations",
    id,
    {
      status: "planned",
    },
  );
}

export async function dismissSiteRecommendation(
  id: string,
  deps: ServiceDeps = {},
): Promise<void> {
  await updateStatus(
    deps.client ?? createAdminClient(),
    "chatbot_site_recommendations",
    id,
    {
      status: "dismissed",
    },
  );
}

type StatusTable =
  | "chatbot_follow_up_tasks"
  | "chatbot_learning_cases"
  | "chatbot_knowledge_suggestions"
  | "chatbot_site_recommendations";

async function updateStatus(
  client: Client,
  table: StatusTable,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // `table` is a union of four tables with different Update shapes, so a
  // patch that's valid for all of them structurally can't satisfy any one
  // of their generated types — this is the one narrow, internal spot where
  // that mismatch is cast away rather than fought with four near-duplicate
  // functions.
  const { error } = await client
    .from(table)
    .update(patch as never)
    .eq("id", id);
  if (error)
    throw new ChatbotAdminError(`Could not update this ${statusNoun(table)}.`);
}

function statusNoun(table: StatusTable): string {
  if (table === "chatbot_follow_up_tasks") return "follow-up task";
  if (table === "chatbot_learning_cases") return "case";
  if (table === "chatbot_knowledge_suggestions") return "knowledge fix";
  return "site recommendation";
}
