import {
  financeTemplatesLandingPage,
  financeTemplatesThankYouPage,
  roadmapLandingPage,
  roadmapThankYouPage,
} from "@/lib/content/lead-magnets";
import { preCallResources } from "@/lib/content/pre-call-resources";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import type { InChatResourceKey } from "@/lib/chatbot/quick-actions";
import { CASE_STUDY_SUMMARIES } from "@/lib/chatbot/site-knowledge";

/**
 * The catalog the `send_resources_email` tool is allowed to send. A closed
 * list on purpose: the model picks a key, never a URL, so it can never mail a
 * visitor a link it invented. Anything not in here (or not a real case-study
 * slug) is rejected by resolveChatbotResources below.
 */
export type ChatbotResource = {
  key: string;
  title: string;
  /** One line, used verbatim in the email and on the in-chat card. */
  blurb: string;
  /** Always a relative path — absolutized against the site URL when emailed. */
  url: string;
  /**
   * The lead-magnet form, for a lead magnet whose `url` is the delivered page.
   * Used in chat until the visitor has given an email (see sharedResourceUrl).
   */
  gatedUrl?: string;
};

/**
 * Marks a link the chatbot handed out. The GA4 confirmation-page report
 * excludes it (ga4/client.ts), so opening a delivered page from the chat is
 * never counted as a form conversion.
 */
export const CHAT_LINK_MARKER = "via=chat";

export const CHATBOT_RESOURCE_CATALOG: readonly ChatbotResource[] = [
  {
    key: "roadmap",
    title: roadmapLandingPage.title,
    blurb:
      "The free 90-day plan: pick a machine, land the first location, launch and scale.",
    // The delivered page for people who already gave us an email (the resource
    // email only goes to such an address), so they are not asked again. Until
    // Adam decides whether the roadmap may be ungated, a visitor who has not
    // given an email gets the form (gatedUrl).
    url: `${roadmapThankYouPage.route_path}?${CHAT_LINK_MARKER}`,
    gatedUrl: roadmapLandingPage.route_path,
  },
  {
    key: "finance_templates",
    title: financeTemplatesLandingPage.title,
    blurb:
      "A self-calculating P&L, cash flow, and balance sheet workbook for a vending route.",
    url: `${financeTemplatesThankYouPage.route_path}?${CHAT_LINK_MARKER}`,
    gatedUrl: financeTemplatesLandingPage.route_path,
  },
  {
    key: "case_studies",
    title: "Member success stories",
    blurb: "Real operators, their prior jobs, and what their routes do now.",
    url: "/case-studies",
  },
];

/** `case_study:<slug>` selects one specific member story from the same index the prompt shows the model. Exported so emails.ts can detect a single-case-study send and build its personal template. */
export const CASE_STUDY_KEY_PREFIX = "case_study:";

export const CHATBOT_RESOURCE_KEYS: readonly string[] = [
  ...CHATBOT_RESOURCE_CATALOG.map((resource) => resource.key),
  `${CASE_STUDY_KEY_PREFIX}<slug>`,
];

/** Cap per email — three links is a useful message, ten is a dump nobody opens. */
export const MAX_RESOURCES_PER_EMAIL = 3;

/**
 * Resolves model-supplied keys to real catalog entries, dropping anything
 * unknown. Returns an empty array when nothing resolves, which the tool
 * treats as "don't send" rather than "send an empty email".
 */
export function resolveChatbotResources(keys: string[]): ChatbotResource[] {
  const resolved: ChatbotResource[] = [];
  const seen = new Set<string>();

  for (const rawKey of keys) {
    const key = rawKey.trim();
    if (!key || seen.has(key)) continue;

    const resource = key.startsWith(CASE_STUDY_KEY_PREFIX)
      ? caseStudyResource(key.slice(CASE_STUDY_KEY_PREFIX.length))
      : (CHATBOT_RESOURCE_CATALOG.find((entry) => entry.key === key) ?? null);

    if (!resource) continue;
    seen.add(key);
    resolved.push(resource);
    if (resolved.length >= MAX_RESOURCES_PER_EMAIL) break;
  }

  return resolved;
}

function caseStudyResource(slug: string): ChatbotResource | null {
  const study = CASE_STUDY_SUMMARIES.find((entry) => entry.slug === slug);
  if (!study) return null;
  return {
    key: `${CASE_STUDY_KEY_PREFIX}${study.slug}`,
    // Colon, not an em dash — no em/en dashes in any generated email
    // (subjects included); this title is used verbatim as a subject line.
    title: `${study.memberName}: ${study.headlineResult}`,
    blurb: `Was ${study.priorBackground} before starting a route.`,
    url: study.url,
  };
}

/**
 * A catalog resource shown IN the chat, no email needed (the widget's "Free
 * 90-day roadmap" quick action). A different kind from `resource_card` on
 * purpose: that kind means "emailed", and both the per-conversation email cap
 * and the engagement summary count it.
 *
 * `emailCaptured`: whether this conversation already has the visitor's email.
 * Only then does the card open the delivered page; otherwise it opens the
 * lead-magnet form, as the site's own links do.
 */
export function sharedResourceMessage(
  key: InChatResourceKey | PreCallVideoKey,
  options: {
    label: string;
    via: "quick_action" | "model";
    emailCaptured: boolean;
  },
  now: Date = new Date(),
): ChatbotMessage | null {
  const resource =
    CHATBOT_RESOURCE_CATALOG.find((entry) => entry.key === key) ??
    PRE_CALL_VIDEOS.find((entry) => entry.key === key);
  if (!resource) return null;
  const url = options.emailCaptured
    ? resource.url
    : (resource.gatedUrl ?? resource.url);
  return {
    role: "assistant",
    content: `Shared ${resource.title} in the chat.`,
    ts: now.toISOString(),
    kind: "shared_resource",
    data: {
      label: options.label,
      via: options.via,
      key: resource.key,
      title: resource.title,
      blurb: resource.blurb,
      url,
    },
  };
}

/**
 * The team's own short answers on /pre-call-resources, one per common
 * question, shareable in chat by the share_resource tool. The card carries the
 * video's own title and links to it on that page; no blurb, so no new copy.
 *
 * `cost_to_join` is the team's answer to the question that opens 15% of chats.
 * Adam watches it and confirms it states no price before CHATBOT_VALUE_FIRST
 * is turned on (the price rule: no number in chat, text or email).
 */
const PRE_CALL_VIDEO_KEYS: Record<string, string> = {
  "cost-to-join": "cost_to_join",
  "what-you-get": "what_you_get",
  "securing-locations": "locations",
  "machine-cost": "machine_cost",
  financing: "financing",
  "what-youll-earn": "earnings",
};

export const PRE_CALL_VIDEO_KEY_LIST = [
  "cost_to_join",
  "what_you_get",
  "locations",
  "machine_cost",
  "financing",
  "earnings",
] as const;
export type PreCallVideoKey = (typeof PRE_CALL_VIDEO_KEY_LIST)[number];

export const PRE_CALL_VIDEOS: readonly ChatbotResource[] =
  preCallResources.items
    .filter((item) => PRE_CALL_VIDEO_KEYS[item.id])
    .map((item) => ({
      key: PRE_CALL_VIDEO_KEYS[item.id] as string,
      title: item.question,
      blurb: "",
      url: `/pre-call-resources#${item.id}`,
    }));
