import "server-only";

import { chatbotBookingUrl, CHATBOT_BOOKING_URL } from "@/lib/chatbot/booking";
import type { ChatbotFlag } from "@/lib/services/chatbot-admin";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import type { ProspectProfile } from "@/lib/chatbot/extract-prospect-profile";
import type { Json } from "@/types/database";

/**
 * §Learning (spec .claude/specs/2026-08-20-site-chatbot.md). Pure
 * deterministic classifier — ZERO LLM calls. Every output is dedupe-keyed so
 * `learning/run.ts` can upsert without duplicating, and re-running this
 * function on the same conversation snapshot always produces the same set of
 * dedupe keys (see scripts/chatbot-learning-smoke.mjs).
 */

export type LearningTopic =
  | "pricing_cost"
  | "getting_started"
  | "locations"
  | "machines"
  | "program_details"
  | "call_booking"
  | "resources"
  | "skepticism"
  | "other";

export type LearningCaseType =
  | "stalled_lead"
  | "uncaptured_engaged"
  | "call_intent_no_booking"
  | "pricing_question_no_capture"
  | "resource_intent_no_capture"
  | "bot_fallback_pattern";

export type LearningConversationInput = {
  id: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  messages: ChatbotMessage[];
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  prospectProfile: ProspectProfile | null;
  flags: ChatbotFlag[];
};

export type LearningCaseOutput = {
  conversationId: string;
  caseType: LearningCaseType;
  topic: LearningTopic;
  confidence: number;
  reasonSummary: string;
  evidence: Json;
  dedupeKey: string;
};

export type FollowUpTaskType =
  | "invite_to_call"
  | "send_resources"
  | "confirm_fit"
  | "general_follow_up";

export type FollowUpTaskOutput = {
  conversationId: string;
  sourceCaseDedupeKey: string;
  taskType: FollowUpTaskType;
  priority: 1 | 2 | 3;
  channel: "email";
  draftSubject: string;
  draftBody: string;
  dueAt: string | null;
  reasonSummary: string;
  dedupeKey: string;
};

export type KnowledgeSuggestionOutput = {
  patternType: string;
  affectedCount: number;
  suggestedText: string;
  sourceCaseDedupeKeys: string[];
  dedupeKey: string;
};

export type InsightOutput = {
  insightType: string;
  title: string;
  summary: string;
  affectedCount: number;
  impactScore: number;
  evidence: Json;
  dedupeKey: string;
};

export type SiteRecommendationOutput = {
  recommendationType: string;
  suggestedTitle: string;
  suggestedBody: string;
  dedupeKey: string;
};

export type LearningEngineResult = {
  cases: LearningCaseOutput[];
  followUpTasks: FollowUpTaskOutput[];
  knowledgeSuggestions: KnowledgeSuggestionOutput[];
  insights: InsightOutput[];
  siteRecommendations: SiteRecommendationOutput[];
};

// One booking destination for the whole system, from lib/chatbot/booking.ts.
// The engine otherwise takes no env/DB dependency so it stays a pure function
// of its arguments.

const TOPIC_LABELS: Record<LearningTopic, string> = {
  pricing_cost: "pricing and cost",
  getting_started: "getting started",
  locations: "locations and placement",
  machines: "machines and equipment",
  program_details: "the program and support",
  call_booking: "booking a call",
  resources: "resources and templates",
  skepticism: "legitimacy concerns",
  other: "other topics",
};

// `s?` on every plain noun below — without it, "machine\b" doesn't match
// "machines" (no word boundary between "e" and "s"), silently dropping
// every plural mention. Caught by scripts/chatbot-learning-smoke.mjs.
const TOPIC_KEYWORDS: Record<Exclude<LearningTopic, "other">, RegExp> = {
  call_booking:
    /\b(book a call|schedule a call|talk to (someone|a person|the team)|hop on a call|jump on a call|set up a call|speak (with|to) (someone|a rep|the team)|phone calls?)\b/gi,
  pricing_cost:
    /\b(prices?|pricing|costs?|how much|fees?|invest(?:ment)?s?|capital|budgets?|expensive|cheap|afford)\b/gi,
  resources:
    /\b(roadmaps?|templates?|resources?|guides?|send (me|over|it)|pdfs?|downloads?|case studies?|case study)\b/gi,
  skepticism:
    /\b(scams?|legit|is this real|too good to be true|sk?eptical|not sure (about|if) this|sounds fake|doubts?|is this a joke)\b/gi,
  locations:
    /\b(locations?|where (can|do) (i|you)|placements?|spots?|sites?|areas?|cit(?:y|ies)|states?|regions?)\b/gi,
  machines:
    /\b(machines?|vending machines?|equipment|kiosks?|micro\s?markets?|combo machines?)\b/gi,
  program_details:
    /\b(programs?|training|support|mentor(?:ship)?|coaching|what('?s| is) included|curriculum)\b/gi,
  getting_started:
    /\b(get started|how (do|does) (it|this) work|first steps?|beginners?|new to (this|vending)|where do i start|how to start)\b/gi,
};

// Scan order breaks ties when a message hits more than one bucket equally —
// intent-shaped topics (booking, pricing) win over broader background ones.
const TOPIC_ORDER: Exclude<LearningTopic, "other">[] = [
  "call_booking",
  "pricing_cost",
  "resources",
  "skepticism",
  "locations",
  "machines",
  "program_details",
  "getting_started",
];

const CALL_INTENT_REGEX = TOPIC_KEYWORDS.call_booking;

// The bot punting to "check the site" / "the team will follow up" with
// nothing captured is the fallback pattern the spec calls out — it means the
// prompt or knowledge base is missing an answer, not that the visitor left.
const BOT_FALLBACK_REGEX =
  /\b(i('| a)?m not (totally |100% )?sure|i don'?t have (that|those) (details|specifics|information)|check (out )?the site|reach out to (the )?team|someone (from )?the team (will|can) (follow up|reach out)|best (to )?check with (the team|someone)|i('| a)?d have to check|not something i can answer)\b/i;

const STALLED_LEAD_HOURS = 24;
const MIN_UNCAPTURED_MESSAGES = 3;
const LIVE_STATUSES = new Set(["active", "abandoned", "lead_captured"]);

export function runLearningEngine(
  conversations: LearningConversationInput[],
  options: { now: Date; bookingUrl?: string } = { now: new Date() },
): LearningEngineResult {
  const now = options.now;
  const bookingUrlOverride = options.bookingUrl ?? null;

  const topicByConversationId = new Map<string, LearningTopic>();
  const cases: LearningCaseOutput[] = [];

  for (const conv of conversations) {
    const userText = conv.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");
    const topic = dominantTopic(userText);
    topicByConversationId.set(conv.id, topic);
    cases.push(...buildCasesForConversation(conv, now, topic));
  }

  const followUpTasks = buildFollowUpTasks(
    conversations,
    cases,
    bookingUrlOverride,
    now,
  );
  const knowledgeSuggestions = buildKnowledgeSuggestions(cases);
  const insights = buildInsights(conversations, topicByConversationId);
  const siteRecommendations = buildSiteRecommendations(insights);

  return {
    cases,
    followUpTasks,
    knowledgeSuggestions,
    insights,
    siteRecommendations,
  };
}

function dominantTopic(text: string): LearningTopic {
  let best: LearningTopic = "other";
  let bestCount = 0;
  for (const topic of TOPIC_ORDER) {
    const count = countMatches(text, TOPIC_KEYWORDS[topic]);
    if (count > bestCount) {
      best = topic;
      bestCount = count;
    }
  }
  return best;
}

function countMatches(text: string, regex: RegExp): number {
  regex.lastIndex = 0;
  return text.match(regex)?.length ?? 0;
}

function buildCasesForConversation(
  conv: LearningConversationInput,
  now: Date,
  topic: LearningTopic,
): LearningCaseOutput[] {
  const userMessages = conv.messages.filter((m) => m.role === "user");
  const assistantMessages = conv.messages.filter((m) => m.role === "assistant");
  const userText = userMessages.map((m) => m.content).join("\n");
  const hasCapture = Boolean(conv.capturedEmail || conv.capturedPhone);
  const cases: LearningCaseOutput[] = [];

  if (hasCapture && LIVE_STATUSES.has(conv.status)) {
    const hoursSinceActivity =
      (now.getTime() - new Date(conv.lastMessageAt).getTime()) / 3_600_000;
    if (hoursSinceActivity >= STALLED_LEAD_HOURS) {
      cases.push({
        conversationId: conv.id,
        caseType: "stalled_lead",
        topic,
        confidence: 0.7,
        reasonSummary: `Captured contact info but no activity for ${Math.floor(hoursSinceActivity / 24)}+ day(s).`,
        evidence: { topic, hoursSinceActivity: Math.round(hoursSinceActivity) },
        dedupeKey: `${conv.id}:stalled_lead`,
      });
    }
  }

  if (!hasCapture && userMessages.length >= MIN_UNCAPTURED_MESSAGES) {
    cases.push({
      conversationId: conv.id,
      caseType: "uncaptured_engaged",
      topic,
      confidence: 0.6,
      reasonSummary: `${userMessages.length} messages sent, never captured.`,
      evidence: { topic, messageCount: userMessages.length },
      dedupeKey: `${conv.id}:uncaptured_engaged`,
    });
  }

  if (countMatches(userText, CALL_INTENT_REGEX) > 0) {
    cases.push({
      conversationId: conv.id,
      caseType: "call_intent_no_booking",
      topic,
      confidence: 0.75,
      reasonSummary: "Visitor asked about booking a call.",
      evidence: { topic, hasCapture },
      dedupeKey: `${conv.id}:call_intent_no_booking`,
    });
  }

  if (!hasCapture && countMatches(userText, TOPIC_KEYWORDS.pricing_cost) > 0) {
    cases.push({
      conversationId: conv.id,
      caseType: "pricing_question_no_capture",
      topic: "pricing_cost",
      confidence: 0.65,
      reasonSummary: "Asked about pricing but never left contact info.",
      evidence: { topic: "pricing_cost" },
      dedupeKey: `${conv.id}:pricing_question_no_capture`,
    });
  }

  if (!hasCapture && countMatches(userText, TOPIC_KEYWORDS.resources) > 0) {
    cases.push({
      conversationId: conv.id,
      caseType: "resource_intent_no_capture",
      topic: "resources",
      confidence: 0.6,
      reasonSummary:
        "Asked for a resource or template but never left contact info.",
      evidence: { topic: "resources" },
      dedupeKey: `${conv.id}:resource_intent_no_capture`,
    });
  }

  if (
    !hasCapture &&
    assistantMessages.some((m) => BOT_FALLBACK_REGEX.test(m.content))
  ) {
    cases.push({
      conversationId: conv.id,
      caseType: "bot_fallback_pattern",
      topic,
      confidence: 0.55,
      reasonSummary:
        'The bot punted to "check the site" / "the team will follow up" instead of answering.',
      evidence: { topic },
      dedupeKey: `${conv.id}:bot_fallback_pattern`,
    });
  }

  return cases;
}

// Only the two case types below assume an available email — the other four
// are uncaptured by definition, so there is no channel to draft a send to.
const TASK_ELIGIBLE_CASE_TYPES = new Set<LearningCaseType>([
  "stalled_lead",
  "call_intent_no_booking",
]);

function buildFollowUpTasks(
  conversations: LearningConversationInput[],
  cases: LearningCaseOutput[],
  bookingUrlOverride: string | null,
  now: Date,
): FollowUpTaskOutput[] {
  const conversationById = new Map(conversations.map((c) => [c.id, c]));
  const nowIso = now.toISOString();
  const tasks: FollowUpTaskOutput[] = [];

  for (const learningCase of cases) {
    if (!TASK_ELIGIBLE_CASE_TYPES.has(learningCase.caseType)) continue;
    const conv = conversationById.get(learningCase.conversationId);
    if (!conv?.capturedEmail) continue;

    // Tagged with the conversation id, so a booking made from a rep-sent
    // draft still attributes back to the chat that started it.
    const bookingUrl =
      bookingUrlOverride ??
      chatbotBookingUrl({
        conversationId: conv.id,
        name: conv.capturedName,
        email: conv.capturedEmail,
      }) ??
      CHATBOT_BOOKING_URL;
    const draft = draftForCase(learningCase.caseType, conv, bookingUrl, nowIso);
    tasks.push({
      conversationId: conv.id,
      sourceCaseDedupeKey: learningCase.dedupeKey,
      taskType: draft.taskType,
      priority: draft.priority,
      channel: "email",
      draftSubject: draft.subject,
      draftBody: draft.body,
      dueAt: draft.dueAt,
      reasonSummary: learningCase.reasonSummary,
      dedupeKey: `${conv.id}:${draft.taskType}`,
    });
  }

  return tasks;
}

function draftForCase(
  caseType: LearningCaseType,
  conv: LearningConversationInput,
  bookingUrl: string,
  nowIso: string,
): {
  taskType: FollowUpTaskType;
  priority: 1 | 2 | 3;
  dueAt: string;
  subject: string;
  body: string;
} {
  const name = conv.capturedName?.trim() || "there";

  if (caseType === "call_intent_no_booking") {
    return {
      taskType: "invite_to_call",
      priority: 1,
      dueAt: nowIso,
      subject: "Following up on your vending business questions",
      body: `Hey ${name}, saw you were asking about hopping on a call — happy to set that up whenever works for you. Here's the link to grab a time: ${bookingUrl}. Talk soon!`,
    };
  }

  // stalled_lead
  return {
    taskType: "general_follow_up",
    priority: 2,
    dueAt: nowIso,
    subject: "Checking back in",
    body: `Hey ${name}, wanted to circle back — still exploring the vending business idea? Happy to answer anything or set up a quick call if that's easier: ${bookingUrl}`,
  };
}

// ≥2 conversations hitting the same (case type, topic) combo is the "shared
// pattern" the spec calls for — a single conversation is just one visitor's
// question, two or more is a knowledge-base gap worth fixing once.
const KNOWLEDGE_CANDIDATE_TYPES = new Set<LearningCaseType>([
  "bot_fallback_pattern",
  "pricing_question_no_capture",
  "resource_intent_no_capture",
]);
const MIN_SHARED_PATTERN = 2;

function buildKnowledgeSuggestions(
  cases: LearningCaseOutput[],
): KnowledgeSuggestionOutput[] {
  const groups = new Map<string, LearningCaseOutput[]>();
  for (const learningCase of cases) {
    if (!KNOWLEDGE_CANDIDATE_TYPES.has(learningCase.caseType)) continue;
    const key = `${learningCase.caseType}:${learningCase.topic}`;
    const list = groups.get(key) ?? [];
    list.push(learningCase);
    groups.set(key, list);
  }

  const suggestions: KnowledgeSuggestionOutput[] = [];
  for (const [key, group] of groups) {
    if (group.length < MIN_SHARED_PATTERN) continue;
    const [caseType, topic] = key.split(":") as [
      LearningCaseType,
      LearningTopic,
    ];
    suggestions.push({
      patternType: key,
      affectedCount: group.length,
      suggestedText: knowledgeSuggestionText(caseType, topic, group.length),
      sourceCaseDedupeKeys: group.map((c) => c.dedupeKey),
      dedupeKey: `knowledge:${key}`,
    });
  }
  return suggestions;
}

function knowledgeSuggestionText(
  caseType: LearningCaseType,
  topic: LearningTopic,
  count: number,
): string {
  const label = TOPIC_LABELS[topic];
  if (caseType === "bot_fallback_pattern") {
    return `${count} visitors asked about ${label} and got a fallback answer ("check the site" / "the team will follow up"). Add specific facts about ${label} to the knowledge base.`;
  }
  if (caseType === "pricing_question_no_capture") {
    return `${count} visitors asked about pricing and left without capturing. Consider adding a clear pricing/investment range to the knowledge base so the bot can answer more directly.`;
  }
  return `${count} visitors asked for a resource or template and left without capturing. Confirm the knowledge base names the right deliverable (roadmap, finance templates) for ${label}.`;
}

const MIN_TOPIC_CONVERSATIONS = 3;

const INSIGHT_TYPE_BY_TOPIC: Record<Exclude<LearningTopic, "other">, string> = {
  pricing_cost: "pricing_confusion",
  getting_started: "missing_answer",
  locations: "missing_answer",
  machines: "missing_answer",
  program_details: "missing_answer",
  call_booking: "call_friction",
  resources: "resource_gap",
  skepticism: "objection",
};

function buildInsights(
  conversations: LearningConversationInput[],
  topicByConversationId: Map<string, LearningTopic>,
): InsightOutput[] {
  const groups = new Map<
    Exclude<LearningTopic, "other">,
    LearningConversationInput[]
  >();
  for (const conv of conversations) {
    const topic = topicByConversationId.get(conv.id);
    // "other" carries no signal about what to fix — excluded from insights,
    // same as it's excluded from the knowledge-suggestion candidate set.
    if (!topic || topic === "other") continue;
    const list = groups.get(topic) ?? [];
    list.push(conv);
    groups.set(topic, list);
  }

  const insights: InsightOutput[] = [];
  for (const [topic, convs] of groups) {
    if (convs.length < MIN_TOPIC_CONVERSATIONS) continue;
    const dropoffs = convs.filter(
      (c) => !(c.capturedEmail || c.capturedPhone),
    ).length;
    const impactScore = dropoffs * 3 + convs.length;
    const insightType = INSIGHT_TYPE_BY_TOPIC[topic];
    const label = TOPIC_LABELS[topic];

    insights.push({
      insightType,
      title: `${convs.length} conversations about ${label}`,
      summary: `${convs.length} conversations touched on ${label}, and ${dropoffs} left without capturing contact info.`,
      affectedCount: convs.length,
      impactScore,
      evidence: {
        topic,
        conversationIds: convs.slice(0, 20).map((c) => c.id),
        dropoffs,
      },
      dedupeKey: `insight:${topic}`,
    });
  }
  return insights;
}

const SITE_RECOMMENDATION_APPLICABLE = new Set([
  "resource_gap",
  "pricing_confusion",
  "missing_answer",
]);

function buildSiteRecommendations(
  insights: InsightOutput[],
): SiteRecommendationOutput[] {
  return insights
    .filter((insight) =>
      SITE_RECOMMENDATION_APPLICABLE.has(insight.insightType),
    )
    .map((insight) => ({
      recommendationType: insight.insightType,
      suggestedTitle: `Address the ${insight.title.toLowerCase()} gap on the site`,
      suggestedBody: `${insight.summary} Consider adding or clarifying on-site content so visitors get this answer before they need to ask the chatbot.`,
      dedupeKey: `siterec:${insight.dedupeKey}`,
    }));
}
