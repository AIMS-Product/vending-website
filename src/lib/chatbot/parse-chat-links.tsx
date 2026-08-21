import type { ReactNode } from "react";

// Matches the same `[anchor text](url)` shape strip-formatting.ts preserves.
const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

const ALLOWED_HOSTS = new Set([
  "vendingpreneurs.com",
  "www.vendingpreneurs.com",
]);

/** Exported for reuse wherever an admin-authored URL needs the same same-site check (e.g. quick_actions). */
export function isSafeChatLinkUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Parses `[text](url)` markdown-link syntax out of chatbot message text into
 * real React nodes — never dangerouslySetInnerHTML. Only two URL shapes get
 * linkified: a relative path starting with "/", or an https URL on
 * vendingpreneurs.com / www.vendingpreneurs.com; anything else renders as
 * plain anchor text, so a model or admin-authored URL can never become an
 * open redirect or off-site link inside the transcript. Used by both the
 * public ChatTranscript and the admin transcript viewer.
 */
export function parseChatLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    const [full, label, url] = match;
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (isSafeChatLinkUrl(url)) {
      const isAbsolute = !url.startsWith("/");
      nodes.push(
        <a
          key={key++}
          href={url}
          className="underline"
          {...(isAbsolute
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(label);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}
