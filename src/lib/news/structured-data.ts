/**
 * FAQPage only.
 *
 * News bodies are plain markdown with no FAQ column, so the questions are read
 * back out of the body using the house convention: a heading whose text is
 * "Frequently asked questions", then alternating `**Question?**` / answer
 * paragraph pairs until the next heading. A post that does not follow the
 * convention simply emits no schema.
 *
 * We deliberately emit nothing else here. Article/BreadcrumbList markup would
 * be a separate claim, and FAQPage is the one that earns the People Also Ask
 * and AI Overview placements these pillar posts are written for.
 */

const FAQ_HEADING = /^#{2,3}\s+frequently asked questions\s*$/i;
const HEADING = /^#{1,6}\s/;
const BOLD_QUESTION = /^\*\*(.+)\*\*$/;

export type FaqEntry = { question: string; answer: string };

/** Pull the `**Question**` / answer pairs out of a post's FAQ section. */
export function extractFaqEntries(body: string): FaqEntry[] {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => FAQ_HEADING.test(line.trim()));
  if (start === -1) return [];

  const entries: FaqEntry[] = [];
  let question: string | null = null;
  let answer: string[] = [];

  const flush = () => {
    const text = answer.join(" ").trim();
    if (question && text)
      entries.push({ question, answer: stripMarkdown(text) });
    question = null;
    answer = [];
  };

  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (HEADING.test(line)) break; // next section ends the FAQ

    const match = BOLD_QUESTION.exec(line);
    if (match) {
      flush();
      question = stripMarkdown(match[1]);
    } else if (question && line) {
      answer.push(line);
    } else if (!line) {
      flush();
    }
  }
  flush();

  return entries;
}

/** Strip the inline markdown that would otherwise leak into schema text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → label
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function newsStructuredData(body: string) {
  const entries = extractFaqEntries(body);
  if (entries.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}
