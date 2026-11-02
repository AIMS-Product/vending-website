/**
 * Links the first plain-text occurrence of `phrase`, skipping headings and text
 * already inside a markdown link or image. Returns null when there is nowhere
 * safe to put it, or the body already links to `href`.
 */
export function addInlineLink(
  body: string,
  phrase: string,
  href: string,
): string | null {
  if (body.includes(`](${href})`)) return null;

  let from = 0;
  for (;;) {
    const at = body.indexOf(phrase, from);
    if (at === -1) return null;
    from = at + phrase.length;

    const lineStart = body.lastIndexOf("\n", at) + 1;
    if (body[lineStart] === "#") continue;

    const before = body.slice(lineStart, at);
    if (before.lastIndexOf("[") > before.lastIndexOf("]")) continue;
    if (before.lastIndexOf("(") > before.lastIndexOf(")")) continue;

    return `${body.slice(0, at)}[${phrase}](${href})${body.slice(from)}`;
  }
}
