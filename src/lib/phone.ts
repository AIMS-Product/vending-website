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
 *
 * No country code starts with 0, so a leading `0` is either the `00`
 * international prefix (kept, as `+`) or a national trunk prefix whose country
 * we cannot know (dropped). Twelve leads were lost in Aug–Sep 2026 to numbers
 * like "0907 812 1075" going out as "+09078121075".
 *
 * ponytail: digit-count heuristics, not a full numbering-plan check. Close can
 * still reject a number this passes; close/sync.ts retries without the phone.
 */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("0")) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}
