export type ArticleHeading = { id: string; text: string };

/**
 * Give every `<h2>` in a rendered article an id and list them for the table
 * of contents. Runs on the already-sanitised HTML (sanitize would strip or
 * prefix ids added earlier). Duplicate headings get `-2`, `-3` suffixes.
 */
export function addHeadingAnchors(html: string): {
  html: string;
  headings: ArticleHeading[];
} {
  const headings: ArticleHeading[] = [];
  const used = new Map<string, number>();

  const anchored = html.replace(
    /<h2(\s[^>]*)?>(.*?)<\/h2>/gi,
    (whole, attrs: string | undefined, inner: string) => {
      const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      if (!text || /\sid=/i.test(attrs ?? "")) return whole;

      const base = slugify(text) || "section";
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;

      headings.push({ id, text });
      return `<h2 id="${id}"${attrs ?? ""}>${inner}</h2>`;
    },
  );

  return { html: anchored, headings };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    );
}
