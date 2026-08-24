import "server-only";

import type { CloseClient } from "@/lib/close/client";
import {
  escapeHtml,
  writeLeadNoteOnce,
  type NoteClient,
  type WriteLeadNoteOnceResult,
} from "@/lib/chatbot/close-note";
import {
  buildEngagementSummary,
  type EngagementConversationRow,
  type EngagementSummary,
} from "@/lib/chatbot/engagement-summary";
import { publicConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The website-engagement briefing a rep reads before they dial.
 *
 * Answers, on the Close lead itself: what page pulled them in, what they
 * asked in their own words, which member story we put in front of them, what
 * they do for a living, and what we emailed them.
 *
 * A NOTE rather than custom fields, deliberately. Every Close field in this
 * codebase is addressed by an ID from an env var, and the fields this would
 * need do not exist in Close yet. A note needs no field IDs, no migration and
 * no deploy coordination, it cannot overwrite anything a rep edited, and it
 * lands in the activity feed which is where a rep actually looks. Filterable
 * custom fields are a strict addition on top of this once the IDs exist.
 *
 * Never throws. It runs inside the Close sync drain, and a lead that synced
 * successfully must not be marked failed over a briefing note.
 */

/**
 * Two entry points, because the two facts arrive at different times.
 *
 * The Close sync knows the lead (`leadSubmissionId`) the moment it creates
 * the Close record. The digest knows only the conversation
 * (`conversationId`) at the moment it stores an extracted profile. Either is
 * enough to reach the same visitor.
 */
export type WriteChatbotEngagementNoteInput = {
  /** The lead the Close record was created from. */
  leadSubmissionId?: string;
  /** The conversation, when the caller has that instead. */
  conversationId?: string;
  /** Known by the sync drain at call time; saves a lookup. */
  closeLeadId?: string | null;
};

export async function writeChatbotEngagementNote(
  input: WriteChatbotEngagementNoteInput,
  deps: { client?: NoteClient; closeClient?: CloseClient } = {},
): Promise<WriteLeadNoteOnceResult | "no-conversation"> {
  try {
    const client = deps.client ?? createAdminClient();
    const conversations = await loadVisitorConversations(client, input);

    const summary = buildEngagementSummary(conversations);
    // A contact-form lead who never chatted lands here and exits cleanly.
    // The note shape is the same for either source; only the data differs.
    if (!summary) return "no-conversation";

    return await writeLeadNoteOnce(
      {
        // Resolve the Close lead from the session that actually captured an
        // email, NOT from the newest one. A returning visitor's later session
        // carries no lead_submission_id of its own, and resolving from it
        // would find no lead and silently drop the note -- which is exactly
        // the multi-session case this aggregation exists to serve.
        conversationId: leadBearingConversationId(conversations, summary),
        closeLeadId: input.closeLeadId ?? null,
        marker: engagementNoteMarker(summary),
        buildHtml: (marker) => engagementNoteHtml(summary, marker),
      },
      deps,
    );
  } catch (error) {
    console.warn("chatbot: could not write Close engagement note", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return "failed";
  }
}

const CONVERSATION_FIELDS =
  "id,page_url,created_at,messages,prospect_profile,visitor_hash,lead_submission_id" as const;

/**
 * Every conversation this human has had with us, not just the one that
 * produced the lead.
 *
 * `visitor_hash` (a sha256 of the vp_chat_vid cookie) is the join key: a
 * visitor who asks two questions on Monday, leaves, and comes back on
 * Thursday to hand over an email is one person to a rep, and Monday's
 * questions are the more useful half of the briefing. Falls back to the
 * single linked conversation when the hash is absent (an older row, or a
 * visitor who blocked the cookie).
 */
async function loadVisitorConversations(
  client: NoteClient,
  input: WriteChatbotEngagementNoteInput,
): Promise<EngagementConversationRow[]> {
  const [column, value] = input.leadSubmissionId
    ? (["lead_submission_id", input.leadSubmissionId] as const)
    : (["id", input.conversationId] as const);
  if (!value) return [];

  const linked = await client
    .from("chatbot_conversations")
    .select(CONVERSATION_FIELDS)
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linked.error || !linked.data) return [];

  const visitorHash = linked.data.visitor_hash;
  if (!visitorHash) return [linked.data];

  const all = await client
    .from("chatbot_conversations")
    .select(CONVERSATION_FIELDS)
    .eq("visitor_hash", visitorHash)
    // Newest first, because the cap below has to bite on the OLDEST sessions.
    // Ascending order here would hand back a heavy visitor's first 20 chats
    // and drop the recent ones, including the session this note is anchored
    // to. buildEngagementSummary sorts into chronological order itself, so
    // the direction here is purely about what survives the limit.
    .order("created_at", { ascending: false })
    // A bounded read: a visitor with hundreds of sessions is a bot or a
    // teammate testing, and either way the note stays a briefing.
    .limit(20);

  // A failed aggregate must not lose the conversation we already have.
  if (all.error || !all.data || all.data.length === 0) return [linked.data];
  return all.data;
}

/**
 * The newest session that produced a lead, falling back to the one the note
 * is anchored to. Only used to find the Close lead; the note itself always
 * links the newest conversation, because that is the transcript a rep opening
 * this lead today wants to read.
 */
function leadBearingConversationId(
  conversations: readonly EngagementConversationRow[],
  summary: EngagementSummary,
): string {
  const withLead = conversations
    .filter((row) => row.lead_submission_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return withLead[0]?.id ?? summary.conversationId;
}

/**
 * One note per conversation, keyed on the newest one, and split by whether
 * profile extraction had run when it was built.
 *
 * The two-stage part matters. The Close sync creates the lead within two
 * minutes of capture, but `prospect_profile` is written by the digest cron
 * that runs afterwards -- so the first note a rep gets has the entry page,
 * the questions and the stories, but not the occupation. Keying the marker on
 * `profileKnown` lets exactly one fuller note follow once extraction lands,
 * instead of either delaying every note behind a cron or silently leaving the
 * occupation off the record forever.
 *
 * The two markers are distinct strings rather than one being a prefix of the
 * other: the dedupe check is a substring match, so an overlapping pair would
 * have the fuller note suppress itself.
 */
function engagementNoteMarker(summary: EngagementSummary): string {
  const stage = summary.profileKnown ? "full" : "initial";
  return `chatbot-engagement-ref:${summary.conversationId}:${stage}`;
}

function engagementNoteHtml(
  summary: EngagementSummary,
  marker: string,
): string {
  const sections: string[] = [
    summary.profileKnown
      ? "<p><strong>Website engagement, captured by the site chatbot</strong></p>"
      : "<p><strong>Website engagement, captured by the site chatbot</strong> (first pass, before the transcript was read for background)</p>",
  ];

  const facts: Array<[string, string | null]> = [
    ["Entry page", summary.entryPage],
    ["What they do now", summary.currentWork],
    ["Why they are looking", summary.motivation],
    ["Timeline", summary.timeline],
    ["Capital", summary.capitalSignal],
    ["Market", summary.stateOrMarket],
  ];
  const factLines = facts
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => `<p>${label}: ${escapeHtml(value)}</p>`);
  sections.push(...factLines);

  if (summary.summary) {
    sections.push(`<p>In one line: ${escapeHtml(summary.summary)}</p>`);
  }

  if (summary.questionsAsked.length > 0) {
    sections.push("<p><strong>What they asked</strong></p>");
    sections.push(list(summary.questionsAsked));
  }

  if (summary.caseStudiesShown.length > 0) {
    sections.push("<p><strong>Member stories they were shown</strong></p>");
    sections.push(
      list(
        summary.caseStudiesShown.map((study) =>
          study.memberName
            ? `${study.memberName} (${absolute(study.url)})`
            : absolute(study.url),
        ),
      ),
    );
  }

  if (summary.resourcesSent.length > 0) {
    sections.push("<p><strong>Resources emailed to them</strong></p>");
    sections.push(list(summary.resourcesSent));
    // Whether they opened any of it is not tracked. Saying nothing is
    // honest; a rep must not read this as "they read it".
  }

  if (summary.objections.length > 0) {
    sections.push("<p><strong>Hesitations they raised</strong></p>");
    sections.push(list(summary.objections));
  }

  if (summary.conversationCount > 1) {
    sections.push(
      `<p>${summary.conversationCount} separate chat sessions, first on ${escapeHtml(summary.firstChattedAt ?? "an earlier visit")}.</p>`,
    );
  }

  sections.push(
    `<p>Full chat transcript: ${escapeHtml(conversationUrl(summary.conversationId))}</p>`,
  );
  sections.push(`<p>Reference: ${escapeHtml(marker)}</p>`);

  return `<body>${sections.join("")}</body>`;
}

function list(items: readonly string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function absolute(path: string): string {
  return `${publicConfig.siteUrl}${path}`;
}

function conversationUrl(conversationId: string): string {
  return `${publicConfig.siteUrl}/admin/chatbot/conversations/${conversationId}`;
}
