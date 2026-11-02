export type CleanedWebflowArticle = {
  body: string;
  excerpt: string;
  coverUrl: string | null;
};

const WEBFLOW_HEADER =
  /^\[\s*!\[[^\]]*\]\([^)]*\)\s*\]\(\/\)[\s\S]*?\[Contact Us\]\(#\)\s*[A-Z][a-z]+ \d{1,2}, \d{4}\s*/;
const WEBFLOW_FOOTER = /\n\[\s*!\[VendingPreneurs Brand Mark\][\s\S]*$/;
// One level of parentheses: real cover URLs include `Micromart-Lounge%20(2).jpg`.
const LEADING_IMAGE = /^!\[[^\]]*\]\(((?:[^()\s]|\([^()\s]*\))+)\)\s*/;

/**
 * The Webflow scrape saved the old site header and footer into nine article
 * bodies, and took the logo as the cover and a stray `[` as the excerpt.
 * Returns null for anything not in that exact shape, so a hand-edited article
 * is never rewritten.
 */
export function cleanWebflowBody(raw: string): CleanedWebflowArticle | null {
  if (!WEBFLOW_HEADER.test(raw) || !WEBFLOW_FOOTER.test(raw)) return null;

  const content = raw.replace(WEBFLOW_HEADER, "").replace(WEBFLOW_FOOTER, "");
  const coverUrl = content.match(LEADING_IMAGE)?.[1] ?? null;
  const withoutCover = content.replace(LEADING_IMAGE, "");

  // The summary paragraph becomes the excerpt, which the article renders as its
  // lead, so it leaves the body rather than printing twice.
  const paragraphEnd = withoutCover.indexOf("\n\n");
  if (paragraphEnd === -1) return null;
  // Webflow pads some paragraphs with zero-width joiners.
  const excerpt = withoutCover
    .slice(0, paragraphEnd)
    .replace(/\u200d/g, "")
    .trim();
  if (excerpt.length < 40 || /^[#![]/.test(excerpt)) return null;

  return {
    body: `${withoutCover.slice(paragraphEnd).trim()}\n`,
    excerpt,
    coverUrl,
  };
}
