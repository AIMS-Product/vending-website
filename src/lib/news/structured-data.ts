import { absoluteUrl, siteName } from "@/lib/site";

/**
 * FAQPage and Article markup for news posts.
 *
 * News bodies are plain markdown with no FAQ column, so the questions are read
 * back out of the body using the house convention: a heading whose text is
 * "Frequently asked questions", then alternating `**Question?**` / answer
 * paragraph pairs until the next heading. A post that does not follow the
 * convention simply emits no FAQPage schema. The Article block describes the
 * post itself; BreadcrumbList is built by the page.
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

export type ArticlePost = {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
};

/**
 * Article markup for a published news post: headline, description, dates,
 * image and publisher, all read from the post's own columns. Optional fields
 * are omitted rather than emitted empty.
 */
export function newsArticleStructuredData(post: ArticlePost) {
  const url = absoluteUrl(`/news/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: post.title,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: siteName,
    },
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.published_at
      ? { datePublished: new Date(post.published_at).toISOString() }
      : {}),
    ...(post.cover_url ? { image: [absoluteUrl(post.cover_url)] } : {}),
  };
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
