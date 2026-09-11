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

import { LINK_DESTINATIONS, type LinkDestination } from "./link-standard";

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

/**
 * Mediums that mark a paid placement. A `google` source with medium `cpc`
 * (and a numeric Google Ads campaign id) is Google Ads, not Organic search;
 * `meta` with `paid` is Meta Ads. Seen in production 2026-09-11: 273 leads
 * over 30 days tagged google/cpc sat under Organic search.
 */
const PAID_MEDIUM =
  /^(cpc|ppc|paid|paid[-_ ]?(search|social)|social[-_ ]?paid|display|pmax)$/;
const PAID_CHANNEL: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  facebook: "Meta Ads",
  fb: "Meta Ads",
  instagram: "Meta Ads",
  ig: "Meta Ads",
};

/** Shown when a tag exists but means nothing (e.g. a link built with "_____"). */
export const UNKNOWN_CHANNEL = "Unknown";

/**
 * The on-site AI setter.
 *
 * Chatbot leads are captured mid-conversation rather than through a form on a
 * campaign link, so they carry no utm_source at all and used to roll up as
 * Website, making the chatbot invisible as a channel. Callers pass
 * `capturedByChatbot` for those (see buildChannelRollup), which only overrides
 * the UNTAGGED case: a visitor who arrived from an Instagram ad and then
 * chatted still belongs to Instagram, because Instagram is what brought them.
 */
export const CHATBOT_CHANNEL = "Chatbot";

/** Search engines, organic. `google` lands here too: it is not Google Ads. */
export const SEARCH_CHANNEL = "Organic search";
/** ChatGPT, Claude, Copilot, Perplexity sending people to the site. */
export const AI_CHANNEL = "AI assistants";
/** Any other outside site that linked to us. */
export const REFERRAL_CHANNEL = "Referral";
/** GHL lander form submissions; the GHL API exposes no UTMs per submission. */
export const GHL_FORMS_CHANNEL = "GHL forms";
/**
 * The Instagram DM setter (Pearl, on ManyChat). Stage events arrive from
 * ManyChat flows as source `manychat`; the booking links Pearl sends are
 * tagged `utm_source=ghl&utm_medium=pearl` (GHL hosts the booking page).
 */
export const INSTAGRAM_DM_CHANNEL = "Instagram DM";
/** The paid low-ticket funnel (campaign `wescale`). Adam, 2026-09-11. */
export const LOW_TICKET_CHANNEL = "Low ticket funnel";

type ChannelRule = { channel: string; person?: string };

/**
 * Exact matches on the lowercased, trimmed `utm_source`.
 *
 * Every key here was observed in production data — this is a map of what the
 * team actually types, not a guess at what they might.
 */
const EXACT: Record<string, ChannelRule> = {
  youtube: { channel: "YouTube" },
  // SUFFIX_CHANNEL already treats "yt" and "fb" as these platforms for
  // person-tagged links, so a bare tag has to agree. Without these, "yt"
  // fell through to titleCase and opened its own "Yt" channel row, splitting
  // YouTube in two.
  yt: { channel: "YouTube" },
  google: { channel: SEARCH_CHANNEL },
  bing: { channel: SEARCH_CHANNEL },
  yahoo: { channel: SEARCH_CHANNEL },
  duckduckgo: { channel: SEARCH_CHANNEL },
  ecosia: { channel: SEARCH_CHANNEL },

  meta: { channel: "Meta" },
  facebook: { channel: "Meta" },
  fb: { channel: "Meta" },

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
  referral: { channel: "Referral" },

  // Link-standard sources (docs/marketing/link-standard.md). Paid platforms are
  // their own channels: a Meta ad and an organic Facebook post answer to
  // different budgets, so folding meta_ads into Meta would hide the spend.
  meta_ads: { channel: "Meta Ads" },
  google_ads: { channel: "Google Ads" },
  ghl_sms: { channel: "SMS" },
  ghl_email: { channel: "Email" },
  ghl_form: { channel: GHL_FORMS_CHANNEL },
  ghl: { channel: INSTAGRAM_DM_CHANNEL },
  manychat: { channel: INSTAGRAM_DM_CHANNEL },
  ltf: { channel: LOW_TICKET_CHANNEL },

  // Tag used by the vendingpreneurs.ai funnel's "Apply Now" button.
  web: { channel: WEBSITE_CHANNEL },
  website: { channel: WEBSITE_CHANNEL },

  // The in-chat booking calendar tags itself; see CHATBOT_BOOKING_UTM_SOURCE.
  chatbot: { channel: CHATBOT_CHANNEL },
};

/**
 * Suffix/prefix patterns for person-tagged links we have not seen yet, so a new
 * "sarah-ig" link lands in Instagram on day one instead of creating its own row
 * and quietly shrinking the channel.
 */
const PERSON_PATTERN =
  /^([a-z]+)[-_](ig|instagram|x|twitter|li|linkedin|yt|youtube|fb|facebook|tt|tiktok|newsletter|email)$/;

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
  tt: "TikTok",
  tiktok: "TikTok",
  newsletter: "Newsletter",
  email: "Newsletter",
};

/** A tag made only of punctuation carries no information (seen: "_____"). */
const MEANINGLESS = /^[^a-z0-9]*$/;

/**
 * GA4's markers for "no UTM on this session" and the spine's own "(not set)"
 * for a blank dimension. All mean the link carried nothing, which is what a
 * blank means here: the visitor landed on our site untagged, so Website.
 */
const BLANK_MARKER = /^\((not set|direct|none)\)$/;
/** GA4's marker when the source is genuinely unknown to it. */
const GA4_PLACEHOLDER = /^\(data not available\)$/;

/**
 * GA4 reports a session's source as the referrer hostname when no UTM was
 * set, so `l.instagram.com`, `t.co` and `bing` arrive as sources. The suffix
 * match lets `www.`, `l.`, `m.` and any other subdomain fall through to the
 * registrable domain. Order matters only where a host could match twice.
 */
const HOST_CHANNEL: ReadonlyArray<[suffix: string, channel: string]> = [
  // Our own properties: the visitor was already ours.
  ["vendingpreneurs.com", WEBSITE_CHANNEL],
  ["vendingpreneurs.ai", WEBSITE_CHANNEL],
  ["vendhubhq.com", WEBSITE_CHANNEL],
  ["vendhub.ai", WEBSITE_CHANNEL],
  ["aimanagingservices.com", WEBSITE_CHANNEL],
  ["aimanagingservices.vercel.app", WEBSITE_CHANNEL],
  ["vercel.com", WEBSITE_CHANNEL],
  ["calendly.com", WEBSITE_CHANNEL],
  // Social platforms, untagged.
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["instagram.com", "Instagram"],
  ["facebook.com", "Meta"],
  ["fb.com", "Meta"],
  ["messenger.com", "Meta"],
  ["linkedin.com", "LinkedIn"],
  ["lnkd.in", "LinkedIn"],
  ["t.co", "X"],
  ["twitter.com", "X"],
  ["x.com", "X"],
  ["tiktok.com", "TikTok"],
  // Specific Google hosts before the generic search match.
  ["gemini.google.com", AI_CHANNEL],
  ["mail.google.com", "Email"],
  // Search engines.
  ["google.com", SEARCH_CHANNEL],
  ["bing.com", SEARCH_CHANNEL],
  ["yahoo.com", SEARCH_CHANNEL],
  ["duckduckgo.com", SEARCH_CHANNEL],
  ["ecosia.org", SEARCH_CHANNEL],
  ["qwant.com", SEARCH_CHANNEL],
  ["baidu.com", SEARCH_CHANNEL],
  ["search.brave.com", SEARCH_CHANNEL],
  ["nortonsafesearch.com", SEARCH_CHANNEL],
  // AI assistants.
  ["chatgpt.com", AI_CHANNEL],
  ["openai.com", AI_CHANNEL],
  ["claude.ai", AI_CHANNEL],
  ["copilot.com", AI_CHANNEL],
  ["copilot.microsoft.com", AI_CHANNEL],
  ["perplexity.ai", AI_CHANNEL],
  // Webmail: a link in an email, whoever sent it.
  ["outlook.live.com", "Email"],
  ["outlook.office.com", "Email"],
  ["mail.yahoo.com", "Email"],
];

/** The channel for a referrer hostname; Referral when it is nobody we know. */
export function channelForHost(host: string): string {
  for (const [suffix, channel] of HOST_CHANNEL) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return channel;
  }
  return REFERRAL_CHANNEL;
}

/**
 * Maps a raw `utm_source` onto its canonical channel.
 *
 * No tag at all means the visitor was already on our site, so it resolves to
 * Website rather than an "(none)" row that hides the site's real contribution.
 */
export function resolveChannel(
  utmSource: string | null | undefined,
  options: {
    capturedByChatbot?: boolean;
    /** Raw `utm_medium`; a paid medium moves google / meta to their ad channels. */
    medium?: string | null;
  } = {},
): ChannelAttribution {
  const trimmed = utmSource?.trim().toLowerCase() ?? "";
  const raw = BLANK_MARKER.test(trimmed) ? "" : trimmed;
  if (!raw) {
    return {
      channel: options.capturedByChatbot ? CHATBOT_CHANNEL : WEBSITE_CHANNEL,
      person: null,
    };
  }
  if (MEANINGLESS.test(raw) || GA4_PLACEHOLDER.test(raw))
    return { channel: UNKNOWN_CHANNEL, person: null };

  const paid = PAID_CHANNEL[raw];
  if (paid && PAID_MEDIUM.test(options.medium?.trim().toLowerCase() ?? ""))
    return { channel: paid, person: null };

  const exact = EXACT[raw];
  if (exact) return { channel: exact.channel, person: exact.person ?? null };

  const match = PERSON_PATTERN.exec(raw);
  if (match) {
    const [, person, platform] = match;
    const channel = SUFFIX_CHANNEL[platform ?? ""];
    if (channel) return { channel, person: titleCase(person ?? "") };
  }

  // A hostname is a referrer GA4 passed through, not a tag anyone typed.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw))
    return { channel: channelForHost(raw), person: null };

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

/** Shown when `utm_term` exists but is not one of the closed destinations. */
export const UNKNOWN_DESTINATION = "unknown";

export type Destination = LinkDestination | typeof UNKNOWN_DESTINATION;

/**
 * Maps a raw `utm_term` onto the destination it names.
 *
 * `utm_term` is the destination under the link standard: it is the field that
 * answers "where were we sending them". Anything off the closed list, including
 * a legacy keyword term, is `unknown` and is shown as such, never dropped and
 * never guessed from the landing page.
 */
export function resolveDestination(
  utmTerm: string | null | undefined,
): Destination {
  const raw = utmTerm?.trim().toLowerCase() ?? "";
  return (LINK_DESTINATIONS as readonly string[]).includes(raw)
    ? (raw as LinkDestination)
    : UNKNOWN_DESTINATION;
}
