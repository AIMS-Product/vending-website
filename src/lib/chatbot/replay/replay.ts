import { buildChatbotSystemPrompt } from "@/lib/chatbot/build-system-prompt";
import { DEFAULT_CHATBOT_CONFIG } from "@/lib/chatbot/config";
import type {
  ChatbotMessage,
  ChatbotMessageKind,
} from "@/lib/chatbot/conversation-store";
import { findPriceLeakInReplies } from "@/lib/chatbot/price-guard";
import { CASE_STUDY_SUMMARIES } from "@/lib/chatbot/site-knowledge";
import {
  chatbotToolDefinitions,
  runChatbotTool,
  type ChatbotToolContext,
} from "@/lib/chatbot/tools";
import { createTurnStream } from "@/lib/chatbot/turn-stream";
import {
  CHATBOT_RESOURCE_CATALOG,
  PRE_CALL_VIDEOS,
} from "@/lib/chatbot/resources";
import {
  chooseForcedTool,
  shouldHoldCalendar,
} from "@/lib/chatbot/value-first";
import { leadMagnetPages } from "@/lib/content/lead-magnets";
import { staticRoutes } from "@/lib/content/site-routes";

/** Every path a reply may link to without it counting as invented. */
export function knownSitePaths(): Set<string> {
  return new Set([
    ...staticRoutes.map((route) => route.path),
    ...leadMagnetPages.map((page) => page.route_path),
    ...CHATBOT_RESOURCE_CATALOG.map((resource) => resource.url),
    ...PRE_CALL_VIDEOS.map((video) => video.url.split("#")[0] as string),
    ...CASE_STUDY_SUMMARIES.map((study) => study.url),
    "/case-studies",
  ]);
}

/**
 * The spec's eval gate (2026-09-23, slice 3): replay frozen opening exchanges
 * through the current prompt and the value-first prompt, with every tool that
 * has a side effect stubbed, and score the next reply. The turn runs through
 * the real createTurnStream, so the guards (price, availability, calendar
 * rewrite) apply exactly as in production.
 *
 * ponytail: scored by fixed rules, not an LLM judge. Every check the spec
 * lists is mechanical once a human has labelled each fixture (disclosed? cost?
 * asked to book? support?), and a rule gives the same score twice.
 */

export type ReplayFixture = {
  id: string;
  category: string;
  source: string;
  labels: {
    disclosed: boolean;
    cost: boolean;
    bookingIntent: boolean;
    support: boolean;
  };
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    kind?: ChatbotMessageKind;
    data?: ChatbotMessage["data"];
  }>;
};

export function parseFixtures(jsonl: string): ReplayFixture[] {
  return jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReplayFixture);
}

export type Variant = "current" | "value_first";

export type ReplayTurn = {
  fixtureId: string;
  variant: Variant;
  /** Visitor messages in the conversation, the replayed one included. */
  visitorMessageCount: number;
  forcedTool: string | undefined;
  heldCalendar: boolean;
  /** Assistant text, in order. */
  texts: string[];
  /** Rich messages the turn added (calendar, cards). */
  cards: Array<{ kind: string; data: ChatbotMessage["data"] }>;
  toolCalls: string[];
  priceBlocked: boolean;
};

/** Tools with effects outside the chat. Replay never runs them. */
const STUBBED_TOOLS: Record<string, string> = {
  send_resources_email: "Sent. Confirm it's on the way in one short sentence.",
  flag_for_team:
    "Done. A teammate will reach out the same day on weekdays; say so.",
  flag_unknown_question: "Logged. Tell them the team will get them the answer.",
};

export async function replayTurn(
  fixture: ReplayFixture,
  variant: Variant,
  options: { model: string; timeZone?: string },
): Promise<ReplayTurn> {
  const valueFirst = variant === "value_first";
  const conversationId = `replay-${fixture.id}`;

  const ts = new Date().toISOString();
  const history: ChatbotMessage[] = fixture.messages.map((m) => ({
    ...m,
    ts,
  }));
  const current = history.at(-1);
  if (current?.role !== "user") {
    throw new Error(`${fixture.id}: last message must be the visitor's`);
  }
  const prior = history.slice(0, -1);
  const visitorMessages = history
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const hasSeenCalendar = prior.some((m) => m.kind === "calendar");
  const timeZone = options.timeZone ?? "America/Chicago";

  const toolContext: ChatbotToolContext = {
    conversationId,
    personaName: "Mia",
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    transcript: history,
    embedDomain: "www.vendingpreneurs.com",
    firstPartyEmail: null,
    checkEmailBudget: async () => false,
    config: DEFAULT_CHATBOT_CONFIG,
    // No database in a replay: every bundled story is treated as published.
    // Only share_case_study reads through this; the tools that write are
    // stubbed below.
    client: {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: CASE_STUDY_SUMMARIES.map((s) => ({ slug: s.slug })),
            error: null,
          }),
        }),
      }),
    } as unknown as ChatbotToolContext["client"],
    timeZone,
    valueFirst,
    holdCalendar: shouldHoldCalendar({ valueFirst, visitorMessages }),
  };
  const forcedTool = chooseForcedTool({
    valueFirst,
    hasSeenCalendar,
    priorMessages: prior,
    message: current.content,
  });

  const system = buildChatbotSystemPrompt({
    personaName: "Mia",
    knowledgeBase: null,
    userTurnCount: visitorMessages.length,
    hasSeenCalendar,
    userTurnsSinceCalendar: null,
    timeZone,
    valueFirst,
  });

  const sink: { messages: ChatbotMessage[]; priceLeak?: unknown } = {
    messages: [],
  };
  const toolCalls: string[] = [];
  const stream = createTurnStream({
    config: { model: options.model },
    modelMessages: [
      { role: "system", content: system },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    sink: sink as Parameters<typeof createTurnStream>[0]["sink"],
    captured: { name: null, email: null, phone: null },
    toolContext,
    forceTool: forcedTool,
    tools: chatbotToolDefinitions(valueFirst),
    runTool: async (name, args, context) => {
      toolCalls.push(name);
      const stub = STUBBED_TOOLS[name];
      return stub ? { result: stub } : runChatbotTool(name, args, context);
    },
  });
  // Drain: the turn only finishes once the stream has been read to the end.
  const reader = stream.getReader();
  while (!(await reader.read()).done) {
    // frames are not needed; sink holds the result
  }

  return {
    fixtureId: fixture.id,
    variant,
    visitorMessageCount: visitorMessages.length,
    forcedTool,
    heldCalendar: toolContext.holdCalendar ?? false,
    texts: sink.messages.filter((m) => !m.kind).map((m) => m.content),
    cards: sink.messages
      .filter((m) => m.kind)
      .map((m) => ({ kind: m.kind as string, data: m.data })),
    toolCalls,
    priceBlocked: Boolean(sink.priceLeak),
  };
}

export const GLITCH_LINE =
  "Sorry, something glitched on my end. Mind sending that again?";

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const CHECKS = [
  "under_word_cap",
  "one_question_max",
  "no_price",
  "no_invented_link",
  "no_story_before_disclosure",
  "story_after_disclosure",
  "no_name_ask_first_reply",
  "no_early_calendar",
  "booking_ask_gets_calendar",
  "support_gets_no_calendar",
  "cost_gets_value",
] as const;
export type CheckName = (typeof CHECKS)[number];

const CASE_STUDY_URLS = new Set(CASE_STUDY_SUMMARIES.map((s) => s.url));
const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s]+)\)/g;
const NAME_ASK =
  /\b(who am i (chatting|talking) with|your name|who do i have the pleasure|what should i call you)\b/i;

function linksIn(texts: readonly string[]): string[] {
  return texts.flatMap((text) =>
    [...text.matchAll(MARKDOWN_LINK)].map((match) => match[1] ?? ""),
  );
}

function isKnownLink(url: string, knownPaths: ReadonlySet<string>): boolean {
  if (/^https?:/i.test(url)) {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)vendingpreneurs\.com$/.test(parsed.hostname)) return false;
      return knownPaths.has(parsed.pathname.replace(/\/$/, "") || "/");
    } catch {
      return false;
    }
  }
  return knownPaths.has(url.split("#")[0]?.replace(/\/$/, "") || "/");
}

/**
 * One reply against every check that applies to it. `null` means the check
 * does not apply to this fixture (a support chat has no story to tell).
 */
export function scoreTurn(
  fixture: ReplayFixture,
  turn: ReplayTurn,
  knownPaths: ReadonlySet<string>,
): Record<CheckName, boolean | null> {
  const { labels } = fixture;
  const text = turn.texts.join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const firstReply = turn.visitorMessageCount === 1;
  const links = linksIn(turn.texts);
  const storyCard = turn.cards.some((c) => c.kind === "case_study_card");
  const storyLink = links.some((l) => l.includes("/case-studies/"));
  const told = storyCard || storyLink;
  const calendar = turn.cards.some((c) => c.kind === "calendar");
  const costVideo = turn.cards.some(
    (c) => c.kind === "shared_resource" && c.data?.key === "cost_to_join",
  );
  const anyCard = turn.cards.some((c) => c.kind !== "calendar");

  return {
    under_word_cap: words <= (firstReply ? 35 : 45),
    one_question_max: (text.match(/\?/g) ?? []).length <= 1,
    no_price: !turn.priceBlocked && findPriceLeakInReplies(turn.texts) === null,
    no_invented_link: links.every(
      (l) => isKnownLink(l, knownPaths) || CASE_STUDY_URLS.has(l),
    ),
    no_story_before_disclosure: labels.disclosed ? null : !told,
    story_after_disclosure:
      labels.disclosed && !labels.support && !labels.bookingIntent
        ? told
        : null,
    no_name_ask_first_reply: firstReply ? !NAME_ASK.test(text) : null,
    no_early_calendar:
      turn.visitorMessageCount <= 2 && !labels.bookingIntent ? !calendar : null,
    booking_ask_gets_calendar: labels.bookingIntent ? calendar : null,
    support_gets_no_calendar: labels.support ? !calendar : null,
    // A cost question should leave with something besides a closed door:
    // the cost video, or any resource/story card.
    cost_gets_value: labels.cost ? costVideo || anyCard : null,
  };
}

export type VariantSummary = {
  variant: Variant;
  turns: number;
  glitches: number;
  /** Passed / applicable, per check. */
  checks: Record<CheckName, { passed: number; applicable: number }>;
  /** Mean pass rate over every applicable check of every turn. */
  score: number;
};

export function summarize(
  variant: Variant,
  scored: Array<{ turn: ReplayTurn; score: Record<CheckName, boolean | null> }>,
): VariantSummary {
  const checks = Object.fromEntries(
    CHECKS.map((name) => [name, { passed: 0, applicable: 0 }]),
  ) as VariantSummary["checks"];
  let passed = 0;
  let applicable = 0;
  for (const { score } of scored) {
    for (const name of CHECKS) {
      const value = score[name];
      if (value === null) continue;
      checks[name].applicable += 1;
      applicable += 1;
      if (value) {
        checks[name].passed += 1;
        passed += 1;
      }
    }
  }
  return {
    variant,
    turns: scored.length,
    glitches: scored.filter(({ turn }) => turn.texts.includes(GLITCH_LINE))
      .length,
    checks,
    score: applicable ? Math.round((passed / applicable) * 1000) / 10 : 0,
  };
}
