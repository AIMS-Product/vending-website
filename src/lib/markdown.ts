import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeSchema,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

/**
 * Sanitisation schema. Built on rehype-sanitize's defaultSchema (which
 * already strips <script>, <style>, event handlers, and javascript: URLs)
 * and extended only to allow:
 *   - <img> with src/alt/width/height/loading attributes (http(s) or root-relative URLs only)
 *   - <a> rel/target attributes (so external links open in new tabs)
 *
 * Tightened beyond default: data: URLs and javascript: URLs in src/href
 * remain blocked by the default schema's protocol allowlist.
 */
const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ["src", /^https?:\/\//, /^\//],
      "alt",
      "width",
      "height",
      ["loading", "lazy", "eager"],
    ],
    a: [...(defaultSchema.attributes?.a ?? []), "rel", "target"],
  },
};

// Hosts whose article-body images may be routed through the Next.js image
// optimizer. Must stay a subset of next.config.ts `images.remotePatterns` —
// an unlisted host would 400 from /_next/image, so it is left untouched.
const OPTIMIZABLE_IMAGE_HOSTS = new Set([
  "aacisvhkmsaabqdvdmmf.supabase.co",
  "cdn.prod.website-files.com",
]);

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * CMS markdown emits plain `<img>` tags, which shipped ~350KB raw JPEGs per
 * image with no lazy-loading (2026-08-31 SEO audit). Rewrite each remote image
 * on an allowed host through `/_next/image` (AVIF/WebP + resize) and default
 * `loading="lazy"` / `decoding="async"`. Runs after sanitisation so the src
 * it rewrites has already passed the protocol allowlist.
 */
function rehypeOptimizeImages() {
  const visit = (node: HastNode) => {
    if (node.tagName === "img" && node.properties) {
      const src = node.properties.src;
      if (typeof src === "string" && /^https?:\/\//.test(src)) {
        try {
          const host = new URL(src).hostname;
          if (OPTIMIZABLE_IMAGE_HOSTS.has(host)) {
            node.properties.src = `/_next/image?url=${encodeURIComponent(src)}&w=1200&q=75`;
          }
        } catch {
          // Unparseable URL — leave the sanitised src as-is.
        }
      }
      node.properties.loading ??= "lazy";
      node.properties.decoding ??= "async";
    }
    for (const child of node.children ?? []) visit(child);
  };
  return (tree: HastNode) => visit(tree);
}

/** Lowercase kebab-case fragment for a heading's text. */
export function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textOf(node: HastNode & { value?: string }): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

/**
 * Give every h2/h3 an id from its text so a chart row or a shared link can
 * jump to that section. Runs after sanitisation (which would otherwise
 * prefix or strip ids); the ids are derived here, never from the source.
 */
function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const seen = new Map<string, number>();
    const visit = (node: HastNode) => {
      if ((node.tagName === "h2" || node.tagName === "h3") && node.properties) {
        const base = headingId(textOf(node));
        if (base) {
          const n = seen.get(base) ?? 0;
          seen.set(base, n + 1);
          node.properties.id = n === 0 ? base : `${base}-${n + 1}`;
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(rehypeHeadingIds)
  .use(rehypeOptimizeImages)
  .use(rehypeStringify);

/**
 * The same pipeline with GitHub-flavoured markdown: tables, strikethrough,
 * task lists, bare autolinks.
 *
 * Opt-in rather than on by default. Every news post and SEO page body already
 * renders through the plain pipeline, and switching them all to GFM would
 * silently change published content — a line of dashes under a heading
 * becomes a table, a bare URL becomes a link. Callers that author their own
 * markdown ask for it; stored body content does not.
 */
const gfmProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(rehypeHeadingIds)
  .use(rehypeOptimizeImages)
  .use(rehypeStringify);

/**
 * Parse a markdown string into sanitised HTML. Always run this on every
 * render of user-supplied body content — the database stores raw markdown.
 */
export async function renderMarkdown(
  source: string,
  { gfm = false }: { gfm?: boolean } = {},
): Promise<string> {
  const file = await (gfm ? gfmProcessor : processor).process(source);
  return String(file);
}
