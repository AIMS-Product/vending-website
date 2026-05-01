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

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

/**
 * Parse a markdown string into sanitised HTML. Always run this on every
 * render of user-supplied body content — the database stores raw markdown.
 */
export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source);
  return String(file);
}
