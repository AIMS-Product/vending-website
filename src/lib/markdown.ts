import { unified } from "unified";
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

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(rehypeOptimizeImages)
  .use(rehypeStringify);

/**
 * Parse a markdown string into sanitised HTML. Always run this on every
 * render of user-supplied body content — the database stores raw markdown.
 */
export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source);
  return String(file);
}
