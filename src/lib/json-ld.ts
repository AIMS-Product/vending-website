/**
 * Serialise a JSON-LD value for `<script type="application/ld+json">` set via
 * `dangerouslySetInnerHTML`. `JSON.stringify` leaves `<` alone, so a CMS title
 * or body containing `</script>` would end the script element and let the rest
 * parse as HTML. Escaping `<` keeps the output valid JSON that parses to the
 * same value.
 */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
