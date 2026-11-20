// What a news post shows search engines and social cards. The SEO fields are
// optional: without them the title is the post title and the description is
// the excerpt cut at a whole word, since excerpts run to ~380 characters and
// Google shows about 155.

export const SEO_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 160;
const FALLBACK_DESCRIPTION_MAX = 155;

type SeoPost = {
  title: string;
  excerpt: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
};

export function newsSeoTitle(post: SeoPost) {
  return post.seo_title?.trim() || post.title;
}

export function newsMetaDescription(post: SeoPost): string | undefined {
  const own = post.meta_description?.trim();
  if (own) return own;
  const excerpt = post.excerpt?.trim().replace(/\s+/g, " ");
  if (!excerpt) return undefined;
  return trimToWord(excerpt, FALLBACK_DESCRIPTION_MAX);
}

export function trimToWord(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const words = (
    lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)
  ).replace(/[\s,;:.\-–—]+$/, "");
  return words;
}
