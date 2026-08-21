import "server-only";

/**
 * Strips markdown and em/en dashes from model output before it is persisted
 * or streamed to the visitor. Belt and suspenders with the prompt's
 * FORMATTING rule (plain prose, no markdown, no dashes) — the model mostly
 * follows it, this catches the times it doesn't.
 */
export function stripChatbotFormatting(text: string): string {
  let output = text;

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

  return output.trim();
}
