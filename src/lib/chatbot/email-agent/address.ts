import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Reply-to address that routes a lead's email reply back to their chat.
 *
 * `c-<conversation uuid>-<sig>@reply.vendingpreneurs.com`, sig = first 16 hex
 * of HMAC-SHA256(secret, conversation id). Without the signature anyone could
 * mail c-<guessed id>@ and drive the agent on somebody else's conversation.
 */
export const REPLY_DOMAIN = "reply.vendingpreneurs.com";

function sign(conversationId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(conversationId)
    .digest("hex")
    .slice(0, 16);
}

export function replyAddress(conversationId: string, secret: string): string {
  return `c-${conversationId}-${sign(conversationId, secret)}@${REPLY_DOMAIN}`;
}

const ADDRESS = new RegExp(
  `^c-([0-9a-f-]{36})-([0-9a-f]{16})@${REPLY_DOMAIN.replace(/\./g, "\\.")}$`,
  "i",
);

/** The conversation id a recipient list was addressed to, if one validly signed address is in it. */
export function conversationFromRecipients(
  recipients: readonly string[],
  secret: string,
): string | null {
  for (const raw of recipients) {
    const address = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
    const match = ADDRESS.exec(address);
    if (!match) continue;
    const [, id, sig] = match;
    const expected = Buffer.from(sign(id, secret));
    const given = Buffer.from(sig);
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      return id;
    }
  }
  return null;
}

/** Comma-separated allowlist; `*` means everyone; empty means nobody (fail closed). */
export function isAllowedRecipient(
  email: string,
  allowlist: string | undefined,
): boolean {
  const wanted = email.trim().toLowerCase();
  const entries = (allowlist ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return entries.includes("*")
    ? wanted.includes("@")
    : entries.includes(wanted);
}

/** The new text of a reply, without the quoted thread under it. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (/^\s*>/.test(line)) break;
    // Gmail wraps "On Wed, Nov 4 ... <x@y.com> wrote:" across two lines; the
    // header's day and time were read as a new time request (2026-11-04).
    if (
      /^On\s/i.test(line.trim()) &&
      /\bwrote:/i.test(lines.slice(index, index + 3).join(" "))
    ) {
      break;
    }
    if (/^-{2,}\s*(Original Message|Forwarded message)/i.test(line.trim()))
      break;
    if (/^From:\s.+/i.test(line.trim()) && kept.length > 0) break;
    kept.push(line);
  }
  return kept.join("\n").trim().slice(0, 2000);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<blockquote[\s\S]*$/i, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n");
}

/** Same mailbox? Ignores case and a "+tag" (Gmail replies from the base address). */
export function sameMailbox(a: string, b: string): boolean {
  const base = (email: string) =>
    email
      .trim()
      .toLowerCase()
      .replace(/\+[^@]*@/, "@");
  return base(a) === base(b);
}
