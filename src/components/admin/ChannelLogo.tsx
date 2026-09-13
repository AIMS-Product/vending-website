/**
 * The mark for one reporting row, so a channel is found by shape and colour
 * instead of by reading eighteen rows of similar text.
 *
 * Brand marks are the real vendor artwork, served from `public/admin/brands`
 * (official assets where the vendor publishes one, otherwise the maintained
 * gilbarbara/logos and Simple Icons sets). Brand colour is the whole point here
 * and is the one place this admin uses it: scanning for YouTube's red is
 * faster than reading "YouTube". Anything we own (the site, the chatbot, a
 * form) gets a neutral glyph so first-party rows stay visually distinct from
 * the platforms we buy or earn traffic from.
 *
 * Matched on the row label the report already produces, lowercased, longest
 * key first: "meta ads" must not resolve as "meta", "google ads" not as
 * "google". An unknown label gets a neutral dot rather than nothing, so every
 * row still lines up.
 */

import Image from "next/image";

type Brand = { file: string; label: string; ext?: "svg" | "png" };

/** Label fragment -> brand file. Files live in public/admin/brands. */
const BRANDS: Record<string, Brand> = {
  youtube: { file: "youtube", label: "YouTube" },
  instagram: { file: "instagram", label: "Instagram" },
  linkedin: { file: "linkedin", label: "LinkedIn" },
  "meta ads": { file: "meta", label: "Meta Ads" },
  meta: { file: "meta", label: "Meta" },
  facebook: { file: "facebook", label: "Facebook" },
  "google ads": { file: "google-ads", label: "Google Ads" },
  "google analytics": { file: "google-analytics", label: "Google Analytics" },
  ga4: { file: "google-analytics", label: "Google Analytics" },
  google: { file: "google", label: "Google" },
  tiktok: { file: "tiktok", label: "TikTok" },
  trustpilot: { file: "trustpilot", label: "Trustpilot" },
  braze: { file: "braze", label: "Braze" },
  close: { file: "close", label: "Close" },
  activecampaign: { file: "activecampaign", label: "ActiveCampaign" },
  "active campaign": { file: "activecampaign", label: "ActiveCampaign" },
  typeform: { file: "typeform", label: "Typeform" },
  zoom: { file: "zoom", label: "Zoom" },
  slack: { file: "slack", label: "Slack" },
  calendly: { file: "calendly", label: "Calendly" },
  bitly: { file: "bitly", label: "Bitly" },
  hubspot: { file: "hubspot", label: "HubSpot" },
  metricool: { file: "metricool", label: "Metricool" },
  kit: { file: "kit", label: "Kit" },
  highlevel: { file: "highlevel", label: "HighLevel" },
  gohighlevel: { file: "highlevel", label: "HighLevel" },
  ghl: { file: "highlevel", label: "HighLevel" },
  // ManyChat publishes no vector mark; this is their own 48px favicon.
  manychat: { file: "manychat", label: "ManyChat", ext: "png" },
};

/**
 * Labels that are a whole brand name and nothing else. "x" cannot be a
 * substring key (it is in "Xxxxx" and "Instagram DM" alike), so it matches
 * only when the label is exactly the brand.
 */
const EXACT_BRANDS: Record<string, Brand> = {
  x: { file: "x", label: "X" },
  "x-twitter": { file: "x", label: "X" },
  twitter: { file: "x", label: "X" },
};

/** Anything we own. Neutral on purpose: these are not brands. */
const OWNED: Record<string, string> = {
  website:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15 15 0 0 0-1.3-3.4A8 8 0 0 1 18.9 8ZM12 4.2c.7 1 1.3 2.2 1.7 3.8h-3.4c.4-1.6 1-2.8 1.7-3.8ZM4.3 14a8 8 0 0 1 0-4h3.3a17 17 0 0 0 0 4H4.3Zm.8 2h2.9c.3 1.3.8 2.4 1.3 3.4A8 8 0 0 1 5.1 16Zm2.9-8H5.1a8 8 0 0 1 4.2-3.4A15 15 0 0 0 8 8Zm4 11.8c-.7-1-1.3-2.2-1.7-3.8h3.4c-.4 1.6-1 2.8-1.7 3.8ZM14.1 14H9.9a15 15 0 0 1 0-4h4.2a15 15 0 0 1 0 4Zm.6 5.4c.5-1 1-2.1 1.3-3.4h2.9a8 8 0 0 1-4.2 3.4ZM16.4 14a17 17 0 0 0 0-4h3.3a8 8 0 0 1 0 4h-3.3Z",
  chatbot:
    "M12 3c5 0 9 3.4 9 7.5S17 18 12 18c-.9 0-1.8-.1-2.6-.3L4 20l1.3-3.6C3.9 15 3 12.9 3 10.5 3 6.4 7 3 12 3Zm-3.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  form: "M6 2h8l6 6v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 2v5h5l-5-5Zm-4 9h8v2H9v-2Zm0 4h8v2H9v-2Z",
  email:
    "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.6 2L12 12.3 19.4 7H4.6Z",
  phone:
    "M6.6 3h3l1.6 4-2 1.3a10 10 0 0 0 6.5 6.5l1.3-2 4 1.6v3a2 2 0 0 1-2 2A16 16 0 0 1 4.6 5a2 2 0 0 1 2-2Z",
  // A podcast: Side Hustle Nation is a show, not a platform with a mark.
  podcast:
    "M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-7 0v-6A3.5 3.5 0 0 1 12 2Zm-6 9h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V19h3v2H8v-2h3v-2.1A6 6 0 0 1 6 11Z",
  all: "M4 13h6v7H4v-7Zm0-9h6v7H4V4Zm10 0h6v16h-6V4Z",
  // A webinar is a screen with someone presenting on it.
  webinar:
    "M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9h16V6H4Zm8 1.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM8.5 14a3.5 3.5 0 0 1 7 0h-7Z",
  // A VSL is a video: a play button.
  vsl: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 6 6 4-6 4V8Z",
  // A low-ticket or internal funnel is drawn as one.
  funnel: "M3 4h18l-7 8v6l-4 2v-8L3 4Z",
};

/**
 * Longest key first so a more specific label wins: "meta ads" before "meta",
 * "google ads" before "google".
 */
const BRAND_KEYS = Object.keys(BRANDS).sort((a, b) => b.length - a.length);

const OWNED_MATCHERS: Array<[RegExp, string]> = [
  [/^all channels/, "all"],
  [/^lane 2|setter|reactivation scraper|sales reactivation/, "phone"],
  [/side hustle|podcast|\bshn\b/, "podcast"],
  [/chatbot|chat\b/, "chatbot"],
  [/webinar/, "webinar"],
  [/\bvsl\b|video sales/, "vsl"],
  [/low ticket|\bltf\b|funnel/, "funnel"],
  [/form|ghl|typeform/, "form"],
  [/email|newsletter/, "email"],
  [/website|organic|direct|seo|landing/, "website"],
];

/** The brand file for a label, or null when the label is not a brand we hold. */
export function brandFor(label: string): Brand | null {
  const key = label.trim().toLowerCase();
  const exact = EXACT_BRANDS[key];
  if (exact) return exact;
  const brand = BRAND_KEYS.find((name) => key.includes(name));
  return brand ? BRANDS[brand]! : null;
}

export function ChannelLogo({ label }: { label: string }) {
  const key = label.trim().toLowerCase();

  const brand = brandFor(label);
  if (brand) {
    return (
      // Vendor artwork served as the file it is: `unoptimized` so the SVG's
      // own colours and gradients are never re-encoded.
      <Image
        src={`/admin/brands/${brand.file}.${brand.ext ?? "svg"}`}
        alt={brand.label}
        width={16}
        height={16}
        unoptimized
        className="size-4 shrink-0 object-contain"
      />
    );
  }

  const owned = OWNED_MATCHERS.find(([pattern]) => pattern.test(key));
  if (owned) {
    return (
      <Glyph path={OWNED[owned[1]]!} color="currentColor" title={label} muted />
    );
  }

  // No mark, but still an aligned slot: a ragged first column is harder to
  // scan than a missing logo.
  return (
    <span
      aria-hidden="true"
      className="bg-ui-line-strong inline-block size-2 shrink-0 rounded-full"
      style={{ margin: "0.4rem" }}
    />
  );
}

function Glyph({
  path,
  color,
  title,
  muted,
}: {
  path: string;
  color: string;
  title: string;
  muted?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 shrink-0 ${muted ? "text-ui-text-subtle" : ""}`}
      fill={color}
      role="img"
      aria-label={title}
    >
      <path d={path} />
    </svg>
  );
}
