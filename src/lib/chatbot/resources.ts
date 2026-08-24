import {
  financeTemplatesLandingPage,
  roadmapLandingPage,
} from "@/lib/content/lead-magnets";
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
};

export const CHATBOT_RESOURCE_CATALOG: readonly ChatbotResource[] = [
  {
    key: "roadmap",
    title: roadmapLandingPage.title,
    blurb:
      "The free 90-day plan: pick a machine, land the first location, launch and scale.",
    url: roadmapLandingPage.route_path,
  },
  {
    key: "finance_templates",
    title: financeTemplatesLandingPage.title,
    blurb:
      "A self-calculating P&L, cash flow, and balance sheet workbook for a vending route.",
    url: financeTemplatesLandingPage.route_path,
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
