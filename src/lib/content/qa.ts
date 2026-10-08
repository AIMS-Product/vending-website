import { parseWebinarStart } from "@/lib/content/masterclass";

/**
 * Anthony's weekly live Q&A (the Zoom "Vendingpreneurs Open House"), the
 * /masterclass look with one job: send people to the Zoom registration.
 * Date and link are GHL custom values the weekly rollover already updates
 * (Adam, 2026-10-08), so the page never needs its own edit.
 */
export const QA_PATH = "/qa";

export const QA_VALUE_NAMES = {
  date: "Anthony Q&A",
  link: "Q&A Link",
} as const;

export const qaCopy = {
  eyebrow: "Free live Q&A with Anthony Kolodziej",
  headline: "Bring your vending questions. Get real answers.",
  highlight: "Get real answers.",
  subheadline: "Live on Zoom with an active operator. Free to join.",
  takeaways: [
    "Ask Anthony anything - locations, machines, financing, your first route",
    "Hear what other new operators are asking right now",
    "Live and unscripted - come with your questions",
  ],
  cardEyebrow: "Live on Zoom",
  cardHeading: "Save your spot",
  cta: "Register on Zoom",
  hint: "Zoom emails your personal join link right after you register.",
  noLink: "Registration opens soon. Check back shortly.",
  bannerLead: "Live Q&A starts in",
  stickyCta: "Save my spot",
  stickyFallback: "Free live Q&A with Anthony",
  proofLead: "Active operator",
};

const HALF_YEAR_MS = 183 * 86_400_000;

/**
 * Reads the GHL Q&A date ("Thursday, October 8 at 1:30pm Central Time") as an
 * instant in Central Time. The value carries no year, so it takes the year
 * that puts the date nearest `now` (a December page reading "January 7" means
 * next year). A value with a year parses as written.
 */
export function parseQaStart(text: string, now: number): Date | null {
  if (/\b\d{4}\b/.test(text)) return parseWebinarStart(text);
  const year = new Date(now).getUTCFullYear();
  const withYear = (y: number) =>
    parseWebinarStart(text.replace(/([A-Za-z]+\s+\d{1,2})(?!\d)/, `$1, ${y}`));
  const start = withYear(year);
  if (!start) return null;
  return start.getTime() < now - HALF_YEAR_MS ? withYear(year + 1) : start;
}

/**
 * The GHL link, only when it is an https Zoom URL. It lands in an href, so a
 * mistyped or hostile value renders as "registration opens soon", never as a
 * link to somewhere else.
 */
export function safeZoomLink(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (host === "zoom.us" || host.endsWith(".zoom.us"))
      ? url.toString()
      : null;
  } catch {
    // Not a URL at all: treated the same as an empty value.
    return null;
  }
}
