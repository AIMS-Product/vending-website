// Deliberately NOT `server-only`: the widget renders the Calendly iframe and
// the admin preview builds a sample URL, so both sides of the request
// boundary import from here. Keep it to pure URL construction.

/**
 * Book-a-call destination. Mirrors the env-override pattern in
 * src/lib/qualification/thank-you-links.ts (a NEXT_PUBLIC_* var read
 * directly, not through the strict envSchema, since it is optional and has a
 * working default). No env var is required for this feature to work.
 */
export const CHATBOT_BOOKING_URL =
  process.env.NEXT_PUBLIC_DEFAULT_CALENDLY_URL ??
  "https://calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery";

/**
 * The attribution chain in two values. Calendly echoes whatever `utm_*`
 * query params the booking page was loaded with back on the
 * `invitee.created` webhook's `payload.tracking` object, so tagging the
 * embed URL with the conversation id is what lets
 * /api/webhooks/calendly say "this booked call came from THAT chat".
 *
 * Do not rename either value without changing the webhook matcher in
 * src/lib/chatbot/booking-attribution.ts in the same commit — they are one
 * contract split across two systems.
 */
export const CHATBOT_BOOKING_UTM_SOURCE = "chatbot";
export const CHATBOT_BOOKING_UTM_MEDIUM = "site_chat";

export type ChatbotBookingUrlOptions = {
  conversationId: string;
  /** Prefills the Calendly form so the visitor types less. Omitted when unknown. */
  name?: string | null;
  email?: string | null;
  /** Adds the inline-embed params. False for a plain link (email, prompt text). */
  embed?: boolean;
  /** Origin hosting the iframe — Calendly requires it for inline embeds. */
  embedDomain?: string | null;
};

/**
 * Builds the Calendly URL for one conversation. Returns null when the base
 * URL is unusable, so a misconfigured env var degrades to "no calendar
 * offered" rather than rendering a broken iframe.
 */
export function chatbotBookingUrl(
  options: ChatbotBookingUrlOptions,
): string | null {
  let url: URL;
  try {
    url = new URL(CHATBOT_BOOKING_URL);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  url.searchParams.set("utm_source", CHATBOT_BOOKING_UTM_SOURCE);
  url.searchParams.set("utm_medium", CHATBOT_BOOKING_UTM_MEDIUM);
  url.searchParams.set("utm_content", options.conversationId);

  if (options.name?.trim()) url.searchParams.set("name", options.name.trim());
  if (options.email?.trim())
    url.searchParams.set("email", options.email.trim());

  if (options.embed) {
    url.searchParams.set("embed_type", "Inline");
    url.searchParams.set("hide_gdpr_banner", "1");
    // Chrome is 100% of the panel width at 420px; Calendly's month view needs
    // the compact layout to stay usable at that size.
    url.searchParams.set("hide_event_type_details", "1");
    if (options.embedDomain) {
      url.searchParams.set("embed_domain", options.embedDomain);
    }
  }

  return url.toString();
}
