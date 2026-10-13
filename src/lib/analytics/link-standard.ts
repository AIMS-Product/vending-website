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
  return checkLinkUtms(utms);
}

/**
 * The same rules against UTMs already pulled apart, for callers that never had
 * the URL. A lead row stores the five values in their own columns, so the
 * coverage report would otherwise have to reassemble a URL just to take it
 * back apart — and the second copy of these rules would drift.
 */
export function checkLinkUtms(utms: LinkUtms): LinkStandardCheck {
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

/**
 * One key per link: the whole five-UTM tuple, lowercased. Matching on fewer
 * than five fields would let two links that differ only in destination
 * collapse into one, which is the exact confusion the registry exists to end.
 * NUL-joined, not "|": Google Ads campaign names carry pipes.
 */
export function utmTupleKey(utms: LinkUtms): string {
  return [utms.source, utms.medium, utms.campaign, utms.content, utms.term]
    .map((value) => normalizeUtmTag(value)?.toLowerCase() ?? "")
    .join("\u0000");
}

/**
 * A tag value, or null when it is not a tag: blank, the Calendly link
 * template's literal "_____" (351 bookings), or an unfilled `{{merge}}` field.
 * Applied inside `utmTupleKey`, so a lead carrying "_____" and an imported
 * registry row storing "" are the same link. The backfill script's `cleanTag`
 * is the same rule; its test pins the two together.
 */
export function normalizeUtmTag(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || /^_+$/.test(trimmed) || trimmed.includes("{{")) return null;
  return trimmed;
}

/**
 * Registry rows the backfill script imported from links already in the wild
 * (`scripts/backfill-marketing-links.mjs`) rather than rows built at
 * /admin/links. They are evidence of what went out, so they are listed with
 * their results, but they never count as "built on the standard".
 */
export const IMPORTED_LINK_PREFIX = "backfill:";

export function isImportedLink(createdBy: string | null | undefined): boolean {
  return Boolean(createdBy?.startsWith(IMPORTED_LINK_PREFIX));
}

/**
 * Whether a registry row holds a URL someone can actually post. Links seen
 * only on Calendly bookings are imported with the bare `https://calendly.com/`
 * base because Calendly does not report which scheduling page was used.
 */
export function isShareableLink(link: {
  base_url: string;
  bitly_url: string | null;
}): boolean {
  if (link.bitly_url) return true;
  return !/^https:\/\/calendly\.com\/?$/.test(link.base_url);
}

/**
 * What a person types, turned into a campaign/content slug: "MH Podcast" ->
 * "mh-podcast". The builder applies it as they type so a space or a capital
 * is never a validation error.
 */
export function toLinkSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .replace(/[-_]{2,}/g, "-");
}

/**
 * The standard source for a tag the team typed by hand before the standard
 * (`mike-ig` -> instagram, `internal-webinar` -> webinar). Used only to
 * pre-fill a rebuild; null when nothing on the list fits, so the person picks.
 */
export function standardSourceFor(
  raw: string | null | undefined,
): LinkSource | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (isOneOf(LINK_SOURCES, value)) return value as LinkSource;
  const suffix = value.split(/[-_]/).at(-1) ?? "";
  const bySuffix: Record<string, LinkSource> = {
    ig: "instagram",
    instagram: "instagram",
    yt: "youtube",
    youtube: "youtube",
    x: "x",
    twitter: "x",
    li: "linkedin",
    linkedin: "linkedin",
    fb: "facebook",
    facebook: "facebook",
    tt: "tiktok",
    tiktok: "tiktok",
    newsletter: "newsletter",
    email: "newsletter",
    webinar: "webinar",
    podcast: "podcast",
  };
  return bySuffix[suffix] ?? null;
}

/**
 * A content id as typed, cleaned the same way: spaces become hyphens and
 * anything off the allowed characters is dropped. Case is kept, because a
 * YouTube video id is case-sensitive.
 */
export function toContentId(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/^[._-]+/, "");
}
