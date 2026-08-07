/**
 * Per-page popup campaigns, held as typed data (repo rule: all visible copy
 * lives in `src/lib/content/`). One `Popup` shape is consumed by the live
 * renderer (`SitePopup`), and later by the admin preview and template seeds —
 * never a second rendering codepath.
 *
 * Every optional field is nullable and presence-gated in the renderer, which
 * is what lets one card component cover every page's popup without variants.
 */

export type PopupTrigger =
  | "IMMEDIATE"
  | "TIME_ON_PAGE"
  | "SCROLL_DEPTH"
  | "IDLE_TIME"
  | "EXIT_INTENT";

export type PopupFrequency = "session" | "once_per_day" | "always";

export interface PopupCta {
  label: string;
  href: string;
}

export interface Popup {
  id: string;
  /** Inactive popups never render for visitors; `?vppopup=preview` still shows them. */
  active: boolean;
  trigger: PopupTrigger;
  /** Seconds for TIME_ON_PAGE/IDLE_TIME, percent for SCROLL_DEPTH, unused otherwise. */
  triggerThreshold: number | null;
  /** Path substrings; empty = every page. Admin and conversion surfaces
   *  (contact, booking, qualify, newsletter, thank-you) are always excluded. */
  targetUrlPatterns: string[];
  frequency: PopupFrequency;
  eyebrow: string | null;
  headline: string;
  body: string;
  primaryCta: PopupCta;
  secondaryCta: PopupCta | null;
  featuredValue: { label: string; value: string; note: string | null } | null;
  offerCode: string | null;
  dismissText: string | null;
  /** Hex accent for the top gradient bar + primary CTA. null = brand orange, no bar. */
  accentColor: string | null;
}

// Both entries ship inactive: flip `active` after copy review. Verify with
// `?vppopup=preview` (shows inactive popups, ignores frequency + targeting).
export const POPUPS: Popup[] = [
  {
    id: "exit-apply",
    active: false,
    trigger: "EXIT_INTENT",
    triggerThreshold: null,
    targetUrlPatterns: [],
    frequency: "once_per_day",
    eyebrow: "Before you go",
    headline: "Not sure where to start with vending?",
    body: "See how Vendingpreneurs members find locations, place machines, and build monthly income — no experience required.",
    primaryCta: { label: "Watch the free training", href: "/contact" },
    secondaryCta: { label: "See member case studies", href: "/case-studies" },
    featuredValue: null,
    offerCode: null,
    dismissText: "No thanks, I'm just browsing",
    accentColor: null,
  },
  {
    id: "case-studies-resources",
    active: false,
    trigger: "SCROLL_DEPTH",
    triggerThreshold: 50,
    targetUrlPatterns: ["/case-studies"],
    frequency: "session",
    eyebrow: null,
    headline: "Get the free vending business roadmap",
    body: "A step-by-step launch checklist covering machines, locations, and your first 90 days.",
    primaryCta: { label: "Grab the roadmap", href: "/resources" },
    secondaryCta: null,
    featuredValue: null,
    offerCode: null,
    dismissText: "Maybe later",
    accentColor: null,
  },
];

/** Field defaults that seed a new campaign — everything but id/active. */
export type PopupTemplateFields = Omit<Popup, "id" | "active">;

export interface PopupTemplate {
  key: string;
  name: string;
  description: string;
  fields: PopupTemplateFields;
}

function templateFields(popup: Popup): PopupTemplateFields {
  return {
    trigger: popup.trigger,
    triggerThreshold: popup.triggerThreshold,
    targetUrlPatterns: popup.targetUrlPatterns,
    frequency: popup.frequency,
    eyebrow: popup.eyebrow,
    headline: popup.headline,
    body: popup.body,
    primaryCta: popup.primaryCta,
    secondaryCta: popup.secondaryCta,
    featuredValue: popup.featuredValue,
    offerCode: popup.offerCode,
    dismissText: popup.dismissText,
    accentColor: popup.accentColor,
  };
}

// Templates are data, not code: adding one = adding an entry here. The first
// two reuse the original code-array campaigns.
export const POPUP_TEMPLATES: PopupTemplate[] = [
  {
    key: "exit-intent",
    name: "Exit intent",
    description: "Catches visitors leaving the page with a training offer.",
    fields: templateFields(POPUPS[0]),
  },
  {
    key: "scroll-offer",
    name: "Scroll offer",
    description: "Offers a resource once the visitor scrolls half the page.",
    fields: templateFields(POPUPS[1]),
  },
  {
    key: "newsletter",
    name: "Newsletter",
    description: "Invites readers to join The Route newsletter.",
    fields: {
      trigger: "TIME_ON_PAGE",
      triggerThreshold: 20,
      targetUrlPatterns: [],
      frequency: "once_per_day",
      eyebrow: "The Route",
      headline: "Vending income tips, straight to your inbox",
      body: "Join The Route — location plays, machine picks, and member wins from the Vendingpreneurs community. No spam, unsubscribe anytime.",
      primaryCta: { label: "Join the newsletter", href: "/newsletter" },
      secondaryCta: null,
      featuredValue: null,
      offerCode: null,
      dismissText: "Not right now",
      accentColor: "#066a99",
    },
  },
  {
    key: "social-proof",
    name: "Social proof",
    description: "Leads with member results to push visitors to case studies.",
    fields: {
      trigger: "SCROLL_DEPTH",
      triggerThreshold: 40,
      targetUrlPatterns: [],
      frequency: "session",
      eyebrow: "Member results",
      headline: "Real people. Real vending income.",
      body: "See how everyday operators used the Vendingpreneurs playbook to place machines and build monthly cash flow.",
      primaryCta: { label: "See the case studies", href: "/case-studies" },
      secondaryCta: { label: "Build your vending route", href: "/contact" },
      featuredValue: {
        label: "The community so far",
        value: "$3M+ in machine sales",
        note: "500+ entrepreneurs launched",
      },
      offerCode: null,
      dismissText: "Maybe later",
      accentColor: "#f47b3b",
    },
  },
  {
    key: "offer-code",
    name: "Offer code",
    description: "Promotes a discount with a copyable offer code.",
    fields: {
      trigger: "EXIT_INTENT",
      triggerThreshold: null,
      targetUrlPatterns: [],
      frequency: "once_per_day",
      eyebrow: "Limited offer",
      headline: "Save on your vending launch",
      body: "Use this code when you book your call and we'll apply the discount to your enrollment. Edit this copy with the real offer before activating.",
      primaryCta: { label: "Claim the offer", href: "/contact" },
      secondaryCta: null,
      featuredValue: null,
      offerCode: "VENDING100",
      dismissText: "No thanks",
      accentColor: "#f47b3b",
    },
  },
  {
    key: "blank",
    name: "Blank",
    description: "Start from an empty card.",
    fields: {
      trigger: "TIME_ON_PAGE",
      triggerThreshold: 10,
      targetUrlPatterns: [],
      frequency: "session",
      eyebrow: null,
      headline: "Headline",
      body: "Write the supporting copy for this offer.",
      primaryCta: { label: "Call to action", href: "/contact" },
      secondaryCta: null,
      featuredValue: null,
      offerCode: null,
      dismissText: null,
      accentColor: null,
    },
  },
];

/**
 * Conversion surfaces where a popup can never show, regardless of targeting
 * (Adam, 2026-08-07): a visitor mid-form or mid-booking must not be
 * interrupted by another CTA. Plain prefix match — "/book" covers
 * /booking-* and /book-my-advisory-call-*, "/schedule" the
 * schedule-your-call-* pages, "/thank-you" both thank-you routes.
 */
const POPUP_EXCLUDED_PATH_PREFIXES = [
  "/admin",
  "/apply",
  "/book",
  "/contact",
  "/newsletter",
  "/qualify",
  "/schedule",
  "/thank-you",
];

export function popupMatchesPath(popup: Popup, pathname: string): boolean {
  if (
    POPUP_EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return false;
  }
  if (popup.targetUrlPatterns.length === 0) return true;
  return popup.targetUrlPatterns.some((pattern) => pathname.includes(pattern));
}

export function pickPopup(
  pathname: string,
  popups: Popup[] = POPUPS,
  { preview = false }: { preview?: boolean } = {},
): Popup | null {
  return (
    popups.find(
      (popup) => (popup.active || preview) && popupMatchesPath(popup, pathname),
    ) ?? null
  );
}

export function popupFrequencyKey(id: string): string {
  return `vp_popup_shown:${id}`;
}

const ONE_DAY_MS = 86_400_000;

/**
 * Storage-agnostic dedup check. `read` is backed by sessionStorage for
 * `session` popups and localStorage (storing a ms timestamp) for
 * `once_per_day`; passing a reader keeps this testable without a DOM.
 */
export function isFrequencyCapped(
  popup: Popup,
  read: (key: string) => string | null,
  now: number,
): boolean {
  if (popup.frequency === "always") return false;
  const raw = read(popupFrequencyKey(popup.id));
  if (!raw) return false;
  if (popup.frequency === "session") return true;
  const shownAt = Number(raw);
  return Number.isFinite(shownAt) && now - shownAt < ONE_DAY_MS;
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Allowlist CTA targets — never hand raw config to navigation. */
export function safePopupHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    return SAFE_PROTOCOLS.has(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
}
