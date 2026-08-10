/**
 * E.164 or nothing.
 *
 * The public lead form takes any text up to 60 characters as a phone, so people
 * type things that are not phone numbers. Close rejects what it cannot parse
 * with a 400 that fails the ENTIRE write, not just the phone field — two leads
 * dead-lettered in production on 2026-08-06 (one person typed `1`, another
 * typed their own email address) and never reached the CRM at all.
 *
 * An empty string means "unusable, drop it": a lead with no phone is worth far
 * more than a lead that never arrives.
 *
 * Returning E.164 also matches how Close stores phones, which is what makes the
 * "already have this number?" comparison in close/sync.ts meaningful.
 */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}
