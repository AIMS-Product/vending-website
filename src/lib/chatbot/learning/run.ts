import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toChatbotMessages } from "@/lib/chatbot/conversation-store";
import { prospectProfileSchema } from "@/lib/chatbot/extract-prospect-profile";
import {
  runLearningEngine,
  type FollowUpTaskOutput,
  type InsightOutput,
  type KnowledgeSuggestionOutput,
  type LearningConversationInput,
  type LearningCaseOutput,
  type SiteRecommendationOutput,
} from "@/lib/chatbot/learning/engine";
import { isChatbotFlag, type ChatbotFlag } from "@/lib/services/chatbot-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

// See spec §Learning: "take 500" — the most recent 500 conversations by
// activity are the ones a daily pass can meaningfully act on. Pushing this
// higher is the upgrade path if the table outgrows it.
const CONVERSATION_TAKE = 500;

export type LearningRunResult = {
  ok: boolean;
  conversationsScanned: number;
  recordsWritten: number;
  cases: number;
  followUpTasks: number;
  knowledgeSuggestions: number;
  insights: number;
  siteRecommendations: number;
  error?: string;
};

export type RunLearningPassOptions = {
  dryRun?: boolean;
  now?: () => Date;
};

export async function runChatbotLearningPass(
  options: RunLearningPassOptions = {},
  deps: { client?: Client } = {},
): Promise<LearningRunResult> {
  const client = deps.client ?? createAdminClient();
  const now = options.now?.() ?? new Date();
  const dryRun = options.dryRun ?? false;

  let runId: string | null = null;
  if (!dryRun) {
    const { data } = await client
      .from("chatbot_learning_runs")
      .insert({ started_at: now.toISOString() })
      .select("id")
      .single();
    runId = data?.id ?? null;
  }

  try {
    const conversations = await loadRecentConversations(client);
    const result = runLearningEngine(conversations, { now });

    let recordsWritten: number;
    if (dryRun) {
      recordsWritten =
        result.cases.length +
        result.followUpTasks.length +
        result.knowledgeSuggestions.length +
        result.insights.length +
        result.siteRecommendations.length;
    } else {
      recordsWritten = await writeLearningOutputs(client, result);
    }

    if (runId) {
      await client
        .from("chatbot_learning_runs")
        .update({
          finished_at: new Date().toISOString(),
          conversations_scanned: conversations.length,
          records_written: recordsWritten,
          ok: true,
        })
        .eq("id", runId);
    }

    return {
      ok: true,
      conversationsScanned: conversations.length,
      recordsWritten,
      cases: result.cases.length,
      followUpTasks: result.followUpTasks.length,
      knowledgeSuggestions: result.knowledgeSuggestions.length,
      insights: result.insights.length,
      siteRecommendations: result.siteRecommendations.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (runId) {
      await client
        .from("chatbot_learning_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          error: message,
        })
        .eq("id", runId);
    }
    console.error("chatbot learning pass failed", { error: message });
    return {
      ok: false,
      conversationsScanned: 0,
      recordsWritten: 0,
      cases: 0,
      followUpTasks: 0,
      knowledgeSuggestions: 0,
      insights: 0,
      siteRecommendations: 0,
      error: message,
    };
  }
}

async function writeLearningOutputs(
  client: Client,
  result: {
    cases: LearningCaseOutput[];
    followUpTasks: FollowUpTaskOutput[];
    knowledgeSuggestions: KnowledgeSuggestionOutput[];
    insights: InsightOutput[];
    siteRecommendations: SiteRecommendationOutput[];
  },
): Promise<number> {
  await upsertCases(client, result.cases);
  const caseIdByDedupeKey = await resolveIdsByDedupeKey(
    client,
    "chatbot_learning_cases",
    result.cases.map((c) => c.dedupeKey),
  );
  await upsertFollowUpTasks(client, result.followUpTasks, caseIdByDedupeKey);
  await upsertKnowledgeSuggestions(
    client,
    result.knowledgeSuggestions,
    caseIdByDedupeKey,
  );
  await upsertInsights(client, result.insights);
  await upsertSiteRecommendations(client, result.siteRecommendations);

  return (
    result.cases.length +
    result.followUpTasks.length +
    result.knowledgeSuggestions.length +
    result.insights.length +
    result.siteRecommendations.length
  );
}

async function loadRecentConversations(
  client: Client,
): Promise<LearningConversationInput[]> {
  const { data, error } = await client
    .from("chatbot_conversations")
    .select(
      "id, status, created_at, last_message_at, messages, captured_name, captured_email, captured_phone, prospect_profile",
    )
    .order("last_message_at", { ascending: false })
    .limit(CONVERSATION_TAKE);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const flagsByConversation = await fetchFlags(
    client,
    rows.map((r) => r.id),
  );

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    messages: toChatbotMessages(row.messages),
    capturedName: row.captured_name,
    capturedEmail: row.captured_email,
    capturedPhone: row.captured_phone,
    prospectProfile: parseProspectProfile(row.prospect_profile),
    flags: flagsByConversation.get(row.id) ?? [],
  }));
}

async function fetchFlags(
  client: Client,
  conversationIds: string[],
): Promise<Map<string, ChatbotFlag[]>> {
  const byConversation = new Map<string, ChatbotFlag[]>();
  if (!conversationIds.length) return byConversation;

  const { data, error } = await client
    .from("chatbot_conversation_flags")
    .select("conversation_id, flag")
    .in("conversation_id", conversationIds);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    if (!isChatbotFlag(row.flag)) continue;
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push(row.flag);
    byConversation.set(row.conversation_id, list);
  }
  return byConversation;
}

function parseProspectProfile(value: unknown) {
  if (!value) return null;
  const parsed = prospectProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function resolveIdsByDedupeKey(
  client: Client,
  table: "chatbot_learning_cases",
  dedupeKeys: string[],
): Promise<Map<string, string>> {
  if (!dedupeKeys.length) return new Map();
  const { data, error } = await client
    .from(table)
    .select("id, dedupe_key")
    .in("dedupe_key", dedupeKeys);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.dedupe_key, row.id]));
}

/**
 * Every upsert* helper below follows the same shape: insert dedupe keys that
 * don't exist yet, and for ones that do, update ONLY the content columns —
 * never `status` / `resolved_at` / `applied_at`. A re-run has to converge on
 * fresh evidence without silently reopening something an admin already
 * dismissed or applied.
 */
async function upsertCases(
  client: Client,
  items: LearningCaseOutput[],
): Promise<void> {
  if (!items.length) return;
  const existing = await existingDedupeKeys(
    client,
    "chatbot_learning_cases",
    items.map((i) => i.dedupeKey),
  );

  const toInsert = items.filter((i) => !existing.has(i.dedupeKey));
  if (toInsert.length) {
    const { error } = await client.from("chatbot_learning_cases").insert(
      toInsert.map((i) => ({
        conversation_id: i.conversationId,
        case_type: i.caseType,
        confidence: i.confidence,
        reason_summary: i.reasonSummary,
        evidence: i.evidence,
        dedupe_key: i.dedupeKey,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const item of items.filter((i) => existing.has(i.dedupeKey))) {
    const { error } = await client
      .from("chatbot_learning_cases")
      .update({
        confidence: item.confidence,
        reason_summary: item.reasonSummary,
        evidence: item.evidence,
      })
      .eq("dedupe_key", item.dedupeKey);
    if (error) throw new Error(error.message);
  }
}

async function upsertFollowUpTasks(
  client: Client,
  items: FollowUpTaskOutput[],
  caseIdByDedupeKey: Map<string, string>,
): Promise<void> {
  if (!items.length) return;
  const existing = await existingDedupeKeys(
    client,
    "chatbot_follow_up_tasks",
    items.map((i) => i.dedupeKey),
  );

  const toInsert = items.filter((i) => !existing.has(i.dedupeKey));
  if (toInsert.length) {
    const { error } = await client.from("chatbot_follow_up_tasks").insert(
      toInsert.map((i) => ({
        conversation_id: i.conversationId,
        learning_case_id: caseIdByDedupeKey.get(i.sourceCaseDedupeKey) ?? null,
        task_type: i.taskType,
        priority: i.priority,
        channel: i.channel,
        draft_subject: i.draftSubject,
        draft_body: i.draftBody,
        due_at: i.dueAt,
        reason_summary: i.reasonSummary,
        dedupe_key: i.dedupeKey,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const item of items.filter((i) => existing.has(i.dedupeKey))) {
    const { error } = await client
      .from("chatbot_follow_up_tasks")
      .update({
        learning_case_id:
          caseIdByDedupeKey.get(item.sourceCaseDedupeKey) ?? null,
        draft_subject: item.draftSubject,
        draft_body: item.draftBody,
        due_at: item.dueAt,
        reason_summary: item.reasonSummary,
      })
      .eq("dedupe_key", item.dedupeKey);
    if (error) throw new Error(error.message);
  }
}

async function upsertKnowledgeSuggestions(
  client: Client,
  items: KnowledgeSuggestionOutput[],
  caseIdByDedupeKey: Map<string, string>,
): Promise<void> {
  if (!items.length) return;
  const existing = await existingDedupeKeys(
    client,
    "chatbot_knowledge_suggestions",
    items.map((i) => i.dedupeKey),
  );

  const sourceCaseIds = (item: KnowledgeSuggestionOutput) =>
    item.sourceCaseDedupeKeys
      .map((key) => caseIdByDedupeKey.get(key))
      .filter((id): id is string => Boolean(id));

  const toInsert = items.filter((i) => !existing.has(i.dedupeKey));
  if (toInsert.length) {
    const { error } = await client.from("chatbot_knowledge_suggestions").insert(
      toInsert.map((i) => ({
        pattern_type: i.patternType,
        affected_count: i.affectedCount,
        suggested_text: i.suggestedText,
        source_case_ids: sourceCaseIds(i),
        dedupe_key: i.dedupeKey,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const item of items.filter((i) => existing.has(i.dedupeKey))) {
    const { error } = await client
      .from("chatbot_knowledge_suggestions")
      .update({
        affected_count: item.affectedCount,
        suggested_text: item.suggestedText,
        source_case_ids: sourceCaseIds(item),
      })
      .eq("dedupe_key", item.dedupeKey);
    if (error) throw new Error(error.message);
  }
}

async function upsertInsights(
  client: Client,
  items: InsightOutput[],
): Promise<void> {
  if (!items.length) return;
  const existing = await existingDedupeKeys(
    client,
    "chatbot_insights",
    items.map((i) => i.dedupeKey),
  );

  const toInsert = items.filter((i) => !existing.has(i.dedupeKey));
  if (toInsert.length) {
    const { error } = await client.from("chatbot_insights").insert(
      toInsert.map((i) => ({
        insight_type: i.insightType,
        title: i.title,
        summary: i.summary,
        affected_count: i.affectedCount,
        impact_score: i.impactScore,
        evidence: i.evidence,
        dedupe_key: i.dedupeKey,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const item of items.filter((i) => existing.has(i.dedupeKey))) {
    const { error } = await client
      .from("chatbot_insights")
      .update({
        title: item.title,
        summary: item.summary,
        affected_count: item.affectedCount,
        impact_score: item.impactScore,
        evidence: item.evidence,
      })
      .eq("dedupe_key", item.dedupeKey);
    if (error) throw new Error(error.message);
  }
}

async function upsertSiteRecommendations(
  client: Client,
  items: SiteRecommendationOutput[],
): Promise<void> {
  if (!items.length) return;
  const existing = await existingDedupeKeys(
    client,
    "chatbot_site_recommendations",
    items.map((i) => i.dedupeKey),
  );

  const toInsert = items.filter((i) => !existing.has(i.dedupeKey));
  if (toInsert.length) {
    const { error } = await client.from("chatbot_site_recommendations").insert(
      toInsert.map((i) => ({
        recommendation_type: i.recommendationType,
        suggested_title: i.suggestedTitle,
        suggested_body: i.suggestedBody,
        dedupe_key: i.dedupeKey,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const item of items.filter((i) => existing.has(i.dedupeKey))) {
    const { error } = await client
      .from("chatbot_site_recommendations")
      .update({
        suggested_title: item.suggestedTitle,
        suggested_body: item.suggestedBody,
      })
      .eq("dedupe_key", item.dedupeKey);
    if (error) throw new Error(error.message);
  }
}

type DedupedTable =
  | "chatbot_learning_cases"
  | "chatbot_follow_up_tasks"
  | "chatbot_knowledge_suggestions"
  | "chatbot_insights"
  | "chatbot_site_recommendations";

async function existingDedupeKeys(
  client: Client,
  table: DedupedTable,
  dedupeKeys: string[],
): Promise<Set<string>> {
  if (!dedupeKeys.length) return new Set();
  const { data, error } = await client
    .from(table)
    .select("dedupe_key")
    .in("dedupe_key", dedupeKeys);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.dedupe_key));
}
