// N18 / issue I11: words-first labels for redirect HTTP status codes so the
// redirects UI never shows a bare "301"/"308" that only an engineer can read.
// Single source shared by the create form and the per-row edit/display, kept in
// the redirects UI folder (presentation only — no validation logic; the allowed
// codes are still enforced server-side in actions.ts).

export type RedirectStatusOption = {
  code: number;
  /** Words-first label, e.g. "Permanent move (301)". */
  label: string;
};

export const REDIRECT_STATUS_OPTIONS: readonly RedirectStatusOption[] = [
  { code: 301, label: "Permanent move (301)" },
  { code: 302, label: "Temporary move (302)" },
  { code: 307, label: "Temporary redirect (307)" },
  { code: 308, label: "Permanent redirect (308)" },
] as const;

export function redirectStatusLabel(code: number): string {
  const match = REDIRECT_STATUS_OPTIONS.find((option) => option.code === code);
  // Unknown/legacy code: still surface words-first, never a bare number.
  return match ? match.label : `Redirect (${code})`;
}
