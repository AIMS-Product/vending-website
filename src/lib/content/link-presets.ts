import type {
  LinkDestination,
  LinkMedium,
  LinkSource,
} from "@/lib/analytics/link-standard";

/**
 * One-click starting points for /admin/links. A preset fills everything that
 * never changes for that kind of link; the person types only what is new
 * (the show, the post, the send). Recipes: docs/marketing/link-standard.md.
 */
export type LinkPreset = {
  key: string;
  label: string;
  /** One line under the button: when to use it. */
  hint: string;
  baseUrl: string;
  source: LinkSource;
  medium: LinkMedium;
  /** Pre-filled campaign; empty means the person names it. */
  campaign: string;
  destination: LinkDestination;
  /** What to type in content, as the field's placeholder. */
  contentHint: string;
};

const SITE = "https://www.vendingpreneurs.com";

export const LINK_PRESETS: readonly LinkPreset[] = [
  {
    key: "mh-podcast",
    label: "Mike podcast",
    hint: "Mike guests on a show. One link per show.",
    baseUrl: `${SITE}/booking-t5-socials`,
    source: "podcast",
    medium: "organic",
    campaign: "mh-podcast",
    destination: "book-call",
    contentHint: "show name, e.g. side-hustle-pro",
  },
  {
    key: "ak-podcast",
    label: "Anthony podcast",
    hint: "Anthony guests on a show. One link per show.",
    baseUrl: `${SITE}/booking-ak-t5`,
    source: "podcast",
    medium: "organic",
    campaign: "ak-podcast",
    destination: "book-call",
    contentHint: "show name, e.g. side-hustle-pro",
  },
  {
    key: "youtube-description",
    label: "YouTube description",
    hint: "The booking link under a video.",
    baseUrl: `${SITE}/booking-youtube`,
    source: "youtube",
    medium: "organic",
    campaign: "",
    destination: "book-call",
    contentHint: "the YouTube video id",
  },
  {
    key: "instagram-bio",
    label: "Instagram bio",
    hint: "Link in bio or a story link.",
    baseUrl: `${SITE}/booking-t5-socials`,
    source: "instagram",
    medium: "organic",
    campaign: "",
    destination: "book-call",
    contentHint: "bio, or the story / reel date",
  },
  {
    key: "newsletter",
    label: "Newsletter",
    hint: "A link in the weekly broadcast.",
    baseUrl: `${SITE}/contact`,
    source: "newsletter",
    medium: "email",
    campaign: "",
    destination: "book-call",
    contentHint: "the button or section, e.g. free-market-analysis",
  },
  {
    key: "ghl-sms",
    label: "GHL text",
    hint: "A link inside a GoHighLevel SMS step.",
    baseUrl: `${SITE}/contact`,
    source: "ghl_sms",
    medium: "sms",
    campaign: "",
    destination: "book-call",
    contentHint: "workflow step, e.g. step-2",
  },
  {
    key: "webinar",
    label: "Webinar invite",
    hint: "Sends people to register for the masterclass.",
    baseUrl: `${SITE}/masterclass`,
    source: "webinar",
    medium: "owned",
    campaign: "",
    destination: "webinar-register",
    contentHint: "where it was posted, e.g. ig-story-oct13",
  },
];

/**
 * Pages people link to most, offered as suggestions on the URL field. Any
 * https URL still works; this only saves typing. Ordered by Sept leads.
 */
export const LINK_PAGES: readonly { url: string; label: string }[] = [
  { path: "/booking-youtube", label: "Booking, YouTube copy" },
  { path: "/booking-t5-socials", label: "Booking, Mike copy" },
  { path: "/booking-ak-t5", label: "Booking, Anthony copy" },
  { path: "/booking-meta", label: "Booking, Meta copy" },
  { path: "/contact", label: "Apply (scored form)" },
  { path: "/", label: "Home" },
  { path: "/masterclass", label: "Masterclass registration" },
  { path: "/resources/roadmap", label: "90-day roadmap download" },
  { path: "/start", label: "Start (webinar booking)" },
  { path: "/case-studies", label: "Case studies" },
].map(({ path, label }) => ({ url: `${SITE}${path}`, label }));
