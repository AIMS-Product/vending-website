import "server-only";

/**
 * Synchronous regex extraction over a single user turn. Called every turn
 * (see spec) — no network call, no LLM. The caller is responsible for only
 * passing user-authored text, never the assistant's own replies.
 */
export type ExtractedLead = {
  email: string | null;
  phone: string | null;
  name: string | null;
};

const EMAIL_REGEX =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/;

// US-shaped phone numbers: optional leading +1, optional parens/dashes/dots/spaces.
const PHONE_REGEX =
  /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/;

const NAME_PATTERNS = [
  /\bmy name is ([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})/i,
  /\bthis is ([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})\b/i,
  /\bi'?m ([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})\b/i,
  /\bit'?s ([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})\b/i,
];

// The "I'm ..." / "it's ..." patterns above match plenty of non-name turns
// ("I'm interested", "I'm not sure yet") — reject when the first captured
// word is one of these instead of a name.
const NAME_STOPWORDS = new Set([
  "interested",
  "looking",
  "trying",
  "not",
  "just",
  "still",
  "new",
  "thinking",
  "wondering",
  "hoping",
  "planning",
  "considering",
  "curious",
  "excited",
  "ready",
  "done",
  "sure",
  "good",
  "fine",
  "okay",
  "ok",
  "here",
  "back",
  "in",
  "on",
  "a",
  "the",
  "very",
  "really",
  "kind",
  "sort",
  "going",
  "gonna",
  "about",
  "asking",
  "wanting",
  "hesitant",
  "worried",
  "nervous",
  "confused",
  "glad",
  "happy",
  "sorry",
  // Conjunctions/connectors that show up right after a name in a longer
  // sentence ("my name is John Smith and my email is...") — stop the name
  // capture here rather than swallowing the next clause as extra words.
  "and",
  "is",
  "my",
  "was",
  "email",
  "phone",
  "number",
  "at",
  "so",
  "who",
  "which",
  "that",
  "with",
  "from",
]);

/** Extracts email, phone, and a first-person self-introduced name, each independently optional. */
export function extractLead(userTurnText: string): ExtractedLead {
  return {
    email: extractEmail(userTurnText),
    phone: extractPhone(userTurnText),
    name: extractName(userTurnText),
  };
}

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(PHONE_REGEX);
  if (!match) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

function extractName(text: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;

    // Truncate at the first stopword rather than only checking the first
    // word — catches "my name is John Smith and my email is..." pulling in
    // "and" as a fake third name word.
    const words: string[] = [];
    for (const word of candidate.split(/\s+/).slice(0, 3)) {
      if (NAME_STOPWORDS.has(word.toLowerCase())) break;
      words.push(word);
    }
    if (words.length === 0) continue;

    const name = words.map(capitalize).join(" ");
    if (name.length > 60) continue;
    return name;
  }
  return null;
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();
}
