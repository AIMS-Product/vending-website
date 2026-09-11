import { z } from "zod";

/**
 * The link standard: the closed lists every outbound marketing link must use.
 *
 * The link IS the attribution. Every channel's click, visit, lead and booking
 * joins back through these five UTM values, and `utm_term` answers "where are
 * we sending them" from the link itself rather than from anything inferred
 * about the landing page. Confirmed with Adam 2026-09-11 (spec list plus `x`
 * and `affiliate`, both already observed in production `utm_source` data).
 *
 * Client-safe on purpose: the builder previews the URL in the browser with the
 * same function the server uses to store it. Human-readable copy of this file
 * is `docs/marketing/link-standard.md`; keep the two in step.
 */

export const LINK_SOURCES = [
  "youtube",
  "instagram",
  "tiktok",
  "facebook",
  "linkedin",
  "x",
  "meta_ads",
  "google_ads",
  "ghl_sms",
  "ghl_email",
  "webinar",
  "chatbot",
  "newsletter",
  "podcast",
  "referral",
  "affiliate",
] as const;

export const LINK_MEDIUMS = [
  "paid",
  "organic",
  "owned",
  "email",
  "sms",
  "chat",
] as const;

/** `utm_term` is the destination: the closed list of places a link can send someone. */
export const LINK_DESTINATIONS = [
  "book-call",
  "lead-magnet",
  "webinar-register",
  "apply",
  "content",
  "none",
] as const;

export type LinkSource = (typeof LINK_SOURCES)[number];
export type LinkMedium = (typeof LINK_MEDIUMS)[number];
export type LinkDestination = (typeof LINK_DESTINATIONS)[number];

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Lowercase slug: `webinar-sept15`, `lead-magnet-90-day`, `vsl`. */
const CAMPAIGN_SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/**
 * A content id is whatever the platform calls the post: a Metricool post id,
 * a Meta ad id, a YouTube video id (mixed case, `-` and `_`), or a GHL step.
 * Only the characters are constrained, not the shape.
 */
const CONTENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const linkStandardSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .url("Enter the full destination URL, starting with https://.")
    .refine((value) => value.startsWith("https://"), {
      message: "Links must use https://.",
    }),
  source: z.enum(LINK_SOURCES, {
    message: "Pick a source from the list.",
  }),
  medium: z.enum(LINK_MEDIUMS, {
    message: "Pick a medium from the list.",
  }),
  campaign: z
    .string()
    .trim()
    .min(1, "Campaign is required.")
    .max(80, "Campaign must be 80 characters or fewer.")
    .regex(
      CAMPAIGN_SLUG,
      "Campaign is a lowercase slug: letters, numbers and hyphens (webinar-sept15).",
    ),
  content: z
    .string()
    .trim()
    .min(1, "Content is required: the post, ad, video or message id.")
    .max(120, "Content must be 120 characters or fewer.")
    .regex(
      CONTENT_ID,
      "Content may contain letters, numbers, dots, hyphens and underscores only.",
    ),
  destination: z.enum(LINK_DESTINATIONS, {
    message: "Pick where this link sends people.",
  }),
});

export type LinkStandardInput = z.infer<typeof linkStandardSchema>;

/**
 * The finished URL. Existing non-UTM query parameters on the base URL are
 * kept; any UTM already on it is replaced, so a pasted link cannot smuggle a
 * stale tag past the standard.
 */
export function buildStandardLink(input: LinkStandardInput): string {
  const url = new URL(input.baseUrl);
  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", input.medium);
  url.searchParams.set("utm_campaign", input.campaign);
  url.searchParams.set("utm_content", input.content);
  url.searchParams.set("utm_term", input.destination);
  return url.toString();
}

export type LinkUtms = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

/** The five UTMs off any URL, or null when the string is not a URL at all. */
export function parseLinkUtms(url: string | null | undefined): LinkUtms | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const read = (key: string) => {
    const value = parsed.searchParams.get(key)?.trim();
    return value ? value : null;
  };
  return {
    source: read("utm_source"),
    medium: read("utm_medium"),
    campaign: read("utm_campaign"),
    content: read("utm_content"),
    term: read("utm_term"),
  };
}

export type LinkStandardCheck = {
  compliant: boolean;
  /** Plain-English problems, one per failed rule. Empty when compliant. */
  problems: string[];
};

/**
 * Does this link carry the standard? Drives the "Fix these links" panel, so
 * the wording is for the person who has to fix the post, not for a log.
 */
export function checkLinkStandard(
  url: string | null | undefined,
): LinkStandardCheck {
  const utms = parseLinkUtms(url);
  if (!utms) return { compliant: false, problems: ["Not a valid URL."] };

  const problems: string[] = [];
  if (!utms.source) problems.push("utm_source is missing.");
  else if (!isOneOf(LINK_SOURCES, utms.source.toLowerCase())) {
    problems.push(`utm_source "${utms.source}" is not on the source list.`);
  }
  if (!utms.medium) problems.push("utm_medium is missing.");
  else if (!isOneOf(LINK_MEDIUMS, utms.medium.toLowerCase())) {
    problems.push(`utm_medium "${utms.medium}" is not on the medium list.`);
  }
  if (!utms.campaign) problems.push("utm_campaign is missing.");
  if (!utms.content) problems.push("utm_content is missing.");
  if (!utms.term) problems.push("utm_term (destination) is missing.");
  else if (!isOneOf(LINK_DESTINATIONS, utms.term.toLowerCase())) {
    problems.push(
      `utm_term "${utms.term}" is not a destination (${LINK_DESTINATIONS.join(", ")}).`,
    );
  }
  return { compliant: problems.length === 0, problems };
}

function isOneOf(list: readonly string[], value: string): boolean {
  return list.includes(value);
}
