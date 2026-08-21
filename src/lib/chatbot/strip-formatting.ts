import "server-only";

// Matches `[anchor text](url)` — anchor has no `]` or newline, url has no
// `)` or whitespace. Deliberately conservative: it only needs to catch what
// the model actually emits per the prompt's LINKS rule, not arbitrary markdown.
const MARKDOWN_LINK_PATTERN = /\[[^\]\n]+\]\([^)\s]+\)/g;

// Placeholder markers wrap each preserved link so none of the strip passes
// below (bold/italic/bullets/etc.) can touch it, even if the URL or anchor
// text itself contains *, _, `, or a line-leading -/•. \x00/\x01 are chosen
// because the model's plain-text output can never contain control bytes.
const LINK_MARKER_START = "\x00";
const LINK_MARKER_END = "\x01";

/**
 * Strips markdown and em/en dashes from model output before it is persisted
 * or streamed to the visitor, EXCEPT `[text](url)` link syntax, which the
 * prompt's LINKS rule requires and which ChatTranscript/admin transcript
 * viewer parse into real anchors. Belt and suspenders with the prompt's
 * FORMATTING rule (plain prose, no markdown, no dashes) — the model mostly
 * follows it, this catches the times it doesn't.
 */
export function stripChatbotFormatting(text: string): string {
  const links: string[] = [];
  let output = text.replace(MARKDOWN_LINK_PATTERN, (match) => {
    links.push(match);
    return `${LINK_MARKER_START}${links.length - 1}${LINK_MARKER_END}`;
  });

  // Fenced and inline code.
  output = output.replace(/```[\s\S]*?```/g, "");
  output = output.replace(/`([^`]*)`/g, "$1");

  // Headers.
  output = output.replace(/^#{1,6}\s+/gm, "");

  // Bold / italic (order matters: triple before double before single).
  output = output.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  output = output.replace(/\*\*(.+?)\*\*/g, "$1");
  output = output.replace(/\*(.+?)\*/g, "$1");
  output = output.replace(/__(.+?)__/g, "$1");
  output = output.replace(/_(.+?)_/g, "$1");

  // Bullet and numbered list markers at the start of a line.
  output = output.replace(/^\s*[-*•]\s+/gm, "");
  output = output.replace(/^\s*\d+\.\s+/gm, "");

  // Em dash / en dash -> comma, so the sentence still reads naturally.
  output = output.replace(/\s*[—–]\s*/g, ", ");

  // Collapse whitespace left behind by the removals above.
  output = output.replace(/[ \t]+/g, " ");
  output = output.replace(/\n{3,}/g, "\n\n");

  // Restore preserved links verbatim.
  output = output.replace(
    new RegExp(`${LINK_MARKER_START}(\\d+)${LINK_MARKER_END}`, "g"),
    (_match, index: string) => links[Number(index)],
  );

  return output.trim();
}
