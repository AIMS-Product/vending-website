/**
 * Classifies a lead as internal (team member, QA run, or automated smoke test)
 * rather than a real prospect.
 *
 * The analytics dashboard defaults to EXCLUDING these. Before this existed the
 * numbers were dominated by test traffic — one round of QA put 45 fake rows
 * against 11 real ones, which is a 4:1 distortion on every chart. Deleting them
 * worked once but does not survive the next test session, so the dashboard
 * filters instead of relying on the table staying clean.
 *
 * Client-safe: pure string predicates, no imports. The admin UI toggle and the
 * server rollups share this one definition so a lead can never be counted as
 * internal in one place and external in another.
 */

/** Domains that only ever belong to us or to an automated test. */
const INTERNAL_EMAIL_DOMAINS = new Set([
  "vendingpreneurs-test.com",
  "example.com",
  "example.org",
  "modern-amenities.com",
  "aimanagingservices.com",
]);

/** Local-part prefixes used by seeded/scripted submissions. */
const INTERNAL_EMAIL_PREFIXES = [
  "test",
  "codex-",
  "claude-",
  "money-page-smoke",
  "vp-",
];

/** Whole-word "test"/"testing"/"smoke" in a submitted name. */
const INTERNAL_NAME_PATTERN = /\b(test|testing|smoke|qa)\b/i;

export function isInternalLead(
  email: string | null | undefined,
  fullName?: string | null,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  if (normalizedEmail) {
    const [localPart = "", domain = ""] = normalizedEmail.split("@");
    if (INTERNAL_EMAIL_DOMAINS.has(domain)) return true;
    // Plus-addressing (adam+vpstaging1@…) is how we tag our own test runs.
    if (localPart.includes("+")) return true;
    if (
      INTERNAL_EMAIL_PREFIXES.some((prefix) => localPart.startsWith(prefix))
    ) {
      return true;
    }
  }

  const normalizedName = fullName?.trim() ?? "";
  return normalizedName ? INTERNAL_NAME_PATTERN.test(normalizedName) : false;
}
