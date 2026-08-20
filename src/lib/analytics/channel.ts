/**
 * Canonical marketing channels for lead attribution.
 *
 * `utm_source` is typed by hand into every link anyone builds, so the stored
 * values fragment: "Instagram" and "instagram" are two rows, "FaceBook" and
 * "meta" are the same platform under two names, and per-person links like
 * "mike-ig" hide a third of Instagram's real volume. This module maps the raw
 * value onto one channel plus, where the tag identified a person, who owned
 * the link — so the channel total is honest without losing individual credit.
 *
 * Pure and dependency-free on purpose: it is the single place both the
 * analytics rollups and any future report agree on what a channel is.
 */

export type ChannelAttribution = {
  /** Canonical channel label, e.g. "Instagram". */
  channel: string;
  /** Who owned the tagged link, when the tag named one. */
  person: string | null;
};

/**
 * Traffic that originates on our own pages rather than a campaign.
 *
 * An untagged lead reached a form after browsing the site, so the site is what
 * earned the submission. Verified against the data: 122 of the 131 untagged
 * leads carry a vendingpreneurs.com referrer. vendingpreneurs.ai is folded in
 * here too — it is a marketing page of ours, not an outside channel.
 */
export const WEBSITE_CHANNEL = "Website";

/** Shown when a tag exists but means nothing (e.g. a link built with "_____"). */
export const UNKNOWN_CHANNEL = "Unknown";

type ChannelRule = { channel: string; person?: string };

/**
 * Exact matches on the lowercased, trimmed `utm_source`.
 *
 * Every key here was observed in production data — this is a map of what the
 * team actually types, not a guess at what they might.
 */
const EXACT: Record<string, ChannelRule> = {
  youtube: { channel: "YouTube" },
  google: { channel: "Google" },

  meta: { channel: "Meta" },
  facebook: { channel: "Meta" },

  instagram: { channel: "Instagram" },
  ig: { channel: "Instagram" },
  "mike-ig": { channel: "Instagram", person: "Mike" },
  "anthony-ig": { channel: "Instagram", person: "Anthony" },

  x: { channel: "X" },
  twitter: { channel: "X" },
  "mike-x": { channel: "X", person: "Mike" },
  "anthony-x": { channel: "X", person: "Anthony" },

  linkedin: { channel: "LinkedIn" },
  li: { channel: "LinkedIn" },
  "anthony-li": { channel: "LinkedIn", person: "Anthony" },
  "mike-li": { channel: "LinkedIn", person: "Mike" },

  newsletter: { channel: "Newsletter" },
  email: { channel: "Newsletter" },
  "mike-newsletter": { channel: "Newsletter", person: "Mike" },
  "anthony-newsletter": { channel: "Newsletter", person: "Anthony" },

  "internal-webinar": { channel: "Webinar" },
  webinar: { channel: "Webinar" },

  tiktok: { channel: "TikTok" },
  podcast: { channel: "Podcast" },
  affiliate: { channel: "Affiliate" },

  // Tag used by the vendingpreneurs.ai funnel's "Apply Now" button.
  web: { channel: WEBSITE_CHANNEL },
  website: { channel: WEBSITE_CHANNEL },
};

/**
 * Suffix/prefix patterns for person-tagged links we have not seen yet, so a new
 * "sarah-ig" link lands in Instagram on day one instead of creating its own row
 * and quietly shrinking the channel.
 */
const PERSON_PATTERN =
  /^([a-z]+)[-_](ig|instagram|x|twitter|li|linkedin|yt|youtube|fb|facebook|newsletter|email)$/;

const SUFFIX_CHANNEL: Record<string, string> = {
  ig: "Instagram",
  instagram: "Instagram",
  x: "X",
  twitter: "X",
  li: "LinkedIn",
  linkedin: "LinkedIn",
  yt: "YouTube",
  youtube: "YouTube",
  fb: "Meta",
  facebook: "Meta",
  newsletter: "Newsletter",
  email: "Newsletter",
};

/** A tag made only of punctuation carries no information (seen: "_____"). */
const MEANINGLESS = /^[^a-z0-9]*$/;

/**
 * Maps a raw `utm_source` onto its canonical channel.
 *
 * No tag at all means the visitor was already on our site, so it resolves to
 * Website rather than an "(none)" row that hides the site's real contribution.
 */
export function resolveChannel(
  utmSource: string | null | undefined,
): ChannelAttribution {
  const raw = utmSource?.trim().toLowerCase() ?? "";
  if (!raw) return { channel: WEBSITE_CHANNEL, person: null };
  if (MEANINGLESS.test(raw)) return { channel: UNKNOWN_CHANNEL, person: null };

  const exact = EXACT[raw];
  if (exact) return { channel: exact.channel, person: exact.person ?? null };

  const match = PERSON_PATTERN.exec(raw);
  if (match) {
    const [, person, platform] = match;
    const channel = SUFFIX_CHANNEL[platform ?? ""];
    if (channel) return { channel, person: titleCase(person ?? "") };
  }

  // An unrecognised tag is still a real campaign, so surface it as itself
  // rather than burying it in Website and overstating the site.
  return { channel: titleCase(raw), person: null };
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
