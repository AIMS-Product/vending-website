// Client-safe: ChatLauncher renders from this, the quick-action route
// validates against it. Pure URL logic only.

/**
 * What a widget quick action does when clicked.
 *
 * The config row stores plain URLs, and two of them used to send people out
 * of the chat: "Book a call" went to an untagged /book-now (so a booking there
 * could never be credited to the chat) and "Free 90-day roadmap" went to the
 * gated form, asking for an email again. Those URLs now resolve to in-chat
 * behaviour here, so the live config needs no edit. Anything else stays a link.
 */
export type QuickActionBehavior =
  | { type: "calendar" }
  | { type: "resource"; key: InChatResourceKey }
  | { type: "link" };

export type InChatResourceKey = "roadmap" | "finance_templates";

const IN_CHAT_PATHS: Record<string, QuickActionBehavior> = {
  "/book-now": { type: "calendar" },
  "/resources/roadmap": { type: "resource", key: "roadmap" },
  "/resources/roadmap-thank-you": { type: "resource", key: "roadmap" },
  "/resources/finance-templates": {
    type: "resource",
    key: "finance_templates",
  },
  "/resources/finance-templates-thank-you": {
    type: "resource",
    key: "finance_templates",
  },
};

const SITE_HOSTS = new Set(["vendingpreneurs.com", "www.vendingpreneurs.com"]);

export function quickActionBehavior(url: string): QuickActionBehavior {
  let path: string;
  try {
    const parsed = new URL(url, "https://www.vendingpreneurs.com");
    if (!SITE_HOSTS.has(parsed.hostname)) return { type: "link" };
    path = parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return { type: "link" };
  }
  return IN_CHAT_PATHS[path] ?? { type: "link" };
}
