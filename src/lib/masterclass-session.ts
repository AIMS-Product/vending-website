import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that this browser just registered, so the confirmation page can write
 * intake answers onto the same GHL contact without a login. Holds only the
 * opaque GHL contact id and an expiry, HMAC-signed. Spec: S1b in
 * .claude/specs/2026-09-30-s1-site-registration.md.
 */
export const SESSION_COOKIE = "mc_session";
/** Covers the confirmation page visit; the cookie is also expired after a save. */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
/** Only the confirmation page (and its server action) ever needs it. */
export const SESSION_COOKIE_PATH = "/masterclass-confirmed";

/** Every write of the cookie (set, overwrite, expire) uses these. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: SESSION_COOKIE_PATH,
} as const;

const MIN_SECRET_LENGTH = 32;
/** GHL ids are alphanumeric; anything else is refused before it reaches a URL. */
const CONTACT_ID = /^[A-Za-z0-9]{1,64}$/;

const usable = (secret: string | undefined): secret is string =>
  (secret?.length ?? 0) >= MIN_SECRET_LENGTH;

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

/** null when the secret is missing or too short, or the id is not a GHL id. */
export function signMasterclassSession(
  contactId: string,
  secret: string | undefined,
  now: Date = new Date(),
): string | null {
  if (!usable(secret) || !CONTACT_ID.test(contactId)) return null;
  const payload = `${contactId}.${now.getTime() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The contact id, or null for a missing, tampered or expired cookie. */
export function verifyMasterclassSession(
  value: string | null | undefined,
  secret: string | undefined,
  now: Date = new Date(),
): string | null {
  if (!value || !usable(secret)) return null;
  const match = /^([A-Za-z0-9]{1,64})\.(\d{1,15})\.([\w-]{43})$/.exec(value);
  if (!match) return null;
  const [, contactId, expires, signature] = match;
  const expected = Buffer.from(sign(`${contactId}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  return Number(expires) > now.getTime() ? contactId : null;
}
