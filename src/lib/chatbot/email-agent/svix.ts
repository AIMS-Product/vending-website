import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend signs webhooks with Svix: HMAC-SHA256 over "id.timestamp.body",
 * keyed with the base64 part of the `whsec_` secret, sent as space-separated
 * "v1,<base64>" entries in `svix-signature`. Rejects anything older than 5
 * minutes so a captured request cannot be replayed later.
 */
export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: Date;
}): boolean {
  const { id, timestamp, signature } = input;
  if (!id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(seconds) || Math.abs(nowSeconds - seconds) > 300) {
    return false;
  }
  const key = Buffer.from(input.secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${input.body}`)
    .digest();
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
