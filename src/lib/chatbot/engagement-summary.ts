/**
 * Turns raw chatbot conversation rows into the handful of facts a rep wants
 * before they dial: what page pulled the visitor in, what they actually
 * asked, which member story landed, what they do for a living, and what we
 * sent them.
 *
 * Deliberately pure and I/O free. Every input already exists in Supabase --
 * this derives, it never captures. Page-view history and email-open tracking
 * are NOT derivable from this data and are not faked here; see the handoff
 * spec, they need real instrumentation.
 *
 * Aggregates across sessions: a visitor who chats on Monday and comes back on
 * Thursday is one person to a rep, and `visitor_hash` is the join key.
 */

import { CASE_STUDY_SUMMARIES } from "@/lib/chatbot/site-knowledge";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { prospectProfileSchema } from "@/lib/chatbot/extract-prospect-profile";

/** A note is a briefing, not an archive. These caps keep it scannable. */
const MAX_QUESTIONS = 8;
const MAX_QUESTION_LENGTH = 240;
const MAX_RESOURCES = 6;

/** Matches the `/case-studies/<slug>` links the prompt forces onto every story mention. */
const CASE_STUDY_LINK_PATTERN = /\/case-studies\/([a-z0-9][a-z0-9-]*)/gi;

export type EngagementConversationRow = {
  id: string;
  /** Present only on the session where the visitor actually handed over an email. */
  lead_submission_id?: string | null;
  page_url: string | null;
  created_at: string;
  messages: unknown;
  prospect_profile: unknown;
};

export type EngagementCaseStudy = {
  slug: string;
  /** The member's name when the slug is one we publish, else null. */
  memberName: string | null;
  url: string;
};

export type EngagementSummary = {
  /** The conversation the note is anchored to (the most recent one). */
  conversationId: string;
  /** How many conversations this visitor has had with us, all sessions. */
  conversationCount: number;
  /**
   * Whether LLM profile extraction has run for this visitor yet.
   *
   * It matters to callers, not just to readers: `prospect_profile` is written
   * by the digest cron, which runs AFTER the Close sync that first creates
   * the lead. A note built before extraction has the page and the questions
   * but not the occupation, so a caller keys its dedupe marker on this to let
   * exactly one fuller note follow once the profile lands.
   */
  profileKnown: boolean;
  entryPage: string | null;
  firstChattedAt: string | null;
  questionsAsked: string[];
  caseStudiesShown: EngagementCaseStudy[];
  resourcesSent: string[];
  currentWork: string | null;
  motivation: string | null;
  timeline: string | null;
  capitalSignal: string | null;
  stateOrMarket: string | null;
  objections: string[];
  summary: string | null;
};

/** Slug -> member name, so a note can say "Anthony Kolodziej" not "anthony-k". */
const CASE_STUDY_NAMES_BY_SLUG = new Map(
  CASE_STUDY_SUMMARIES.map((study) => [
    study.slug.toLowerCase(),
    study.memberName,
  ]),
);

/**
 * `messages` is jsonb, so it is `unknown` until proven otherwise. Anything
 * that is not a well-formed message is dropped rather than throwing: a single
 * malformed row must not cost a rep the whole briefing.
 */
function readMessages(value: unknown): ChatbotMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ChatbotMessage => {
    if (typeof entry !== "object" || entry === null) return false;
    const candidate = entry as Partial<ChatbotMessage>;
    return (
      (candidate.role === "user" || candidate.role === "assistant") &&
      typeof candidate.content === "string"
    );
  });
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}

/**
 * The visitor's own words, deduped and in order. Only `text` messages: a
 * rich message's `content` is our own narration ("Opened the booking calendar
 * in the chat."), which is not a question the visitor asked.
 */
function extractQuestions(
  conversations: EngagementConversationRow[],
): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];

  for (const conversation of conversations) {
    for (const message of readMessages(conversation.messages)) {
      if (message.role !== "user") continue;
      if (message.kind && message.kind !== "text") continue;

      const text = collapseWhitespace(message.content);
      if (!text) continue;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(truncate(text, MAX_QUESTION_LENGTH));
    }
  }

  return questions.slice(0, MAX_QUESTIONS);
}

/**
 * Which member stories the bot actually put in front of this visitor.
 *
 * Read off the assistant's own messages rather than tracked separately: the
 * prompt requires every story mention to carry a `/case-studies/<slug>` link,
 * so the transcript is already the record. An unrecognised slug is still
 * reported (with a null name) instead of being dropped, because a story we
 * stopped publishing is exactly the case a rep should not be blindsided by.
 */
function extractCaseStudies(
  conversations: EngagementConversationRow[],
): EngagementCaseStudy[] {
  const bySlug = new Map<string, EngagementCaseStudy>();

  for (const conversation of conversations) {
    for (const message of readMessages(conversation.messages)) {
      if (message.role !== "assistant") continue;

      CASE_STUDY_LINK_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = CASE_STUDY_LINK_PATTERN.exec(message.content)) !== null) {
        const slug = match[1].toLowerCase();
        if (bySlug.has(slug)) continue;
        bySlug.set(slug, {
          slug,
          memberName: CASE_STUDY_NAMES_BY_SLUG.get(slug) ?? null,
          url: `/case-studies/${slug}`,
        });
      }
    }
  }

  return [...bySlug.values()];
}

/**
 * Resources the bot emailed, taken from the `resource_card` messages the
 * send tool writes. This covers what was OFFERED and SENT. Whether the
 * visitor opened the email or clicked anything is not tracked anywhere and is
 * deliberately not guessed at here.
 */
function extractResources(
  conversations: EngagementConversationRow[],
): string[] {
  const titles = new Set<string>();

  for (const conversation of conversations) {
    for (const message of readMessages(conversation.messages)) {
      if (message.kind !== "resource_card") continue;

      const resources = message.data?.resources;
      if (!Array.isArray(resources)) continue;

      for (const resource of resources) {
        if (typeof resource !== "object" || resource === null) continue;
        const title = (resource as { title?: unknown }).title;
        if (typeof title !== "string") continue;
        const clean = collapseWhitespace(title);
        if (clean) titles.add(clean);
      }
    }
  }

  return [...titles].slice(0, MAX_RESOURCES);
}

/**
 * Newest non-null value wins, field by field. A later conversation where the
 * visitor never restated their job should not blank out the job we learned
 * the first time, so this merges rather than replacing wholesale.
 */
function mergeProfiles(conversations: EngagementConversationRow[]) {
  const merged = {
    profileKnown: false,
    currentWork: null as string | null,
    motivation: null as string | null,
    timeline: null as string | null,
    capitalSignal: null as string | null,
    stateOrMarket: null as string | null,
    objections: [] as string[],
    summary: null as string | null,
  };

  // Oldest first so newer values overwrite older ones.
  for (const conversation of conversations) {
    const parsed = prospectProfileSchema.safeParse(
      conversation.prospect_profile,
    );
    if (!parsed.success) continue;
    const profile = parsed.data;
    // Every field on the schema has a .catch(), so an empty object parses
    // cleanly. "Extraction has run" has to mean it actually told us
    // something, or a caller would treat a blank profile as the final word.
    if (
      profile.current_work ||
      profile.motivation ||
      profile.summary ||
      profile.timeline ||
      profile.capital_signal ||
      profile.state_or_market
    ) {
      merged.profileKnown = true;
    }

    merged.currentWork = profile.current_work ?? merged.currentWork;
    merged.motivation = profile.motivation ?? merged.motivation;
    merged.timeline = profile.timeline ?? merged.timeline;
    merged.capitalSignal = profile.capital_signal ?? merged.capitalSignal;
    merged.stateOrMarket = profile.state_or_market ?? merged.stateOrMarket;
    merged.summary = profile.summary ?? merged.summary;
    if (profile.objections.length > 0) merged.objections = profile.objections;
  }

  return merged;
}

/**
 * Builds the briefing. `conversations` may arrive in any order; this sorts
 * oldest-first internally so "entry page" means the FIRST page that pulled
 * them in, across every session, not the most recent one.
 *
 * Returns null when there is nothing worth telling a rep, so a caller can
 * skip writing an empty note.
 */
export function buildEngagementSummary(
  conversations: readonly EngagementConversationRow[],
): EngagementSummary | null {
  if (conversations.length === 0) return null;

  const ordered = [...conversations].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const newest = ordered[ordered.length - 1];
  const profile = mergeProfiles(ordered);

  const summary: EngagementSummary = {
    conversationId: newest.id,
    conversationCount: ordered.length,
    entryPage: ordered.find((row) => row.page_url)?.page_url ?? null,
    firstChattedAt: ordered[0].created_at,
    questionsAsked: extractQuestions(ordered),
    caseStudiesShown: extractCaseStudies(ordered),
    resourcesSent: extractResources(ordered),
    ...profile,
  };

  return hasAnythingToSay(summary) ? summary : null;
}

/**
 * A note saying only "this person chatted" is noise in a rep's activity feed.
 * The entry page alone counts: "they came in on /vending-machine-business"
 * is real context even with no other signal.
 */
function hasAnythingToSay(summary: EngagementSummary): boolean {
  return Boolean(
    summary.entryPage ||
    summary.questionsAsked.length > 0 ||
    summary.caseStudiesShown.length > 0 ||
    summary.resourcesSent.length > 0 ||
    summary.currentWork ||
    summary.motivation ||
    summary.summary,
  );
}
