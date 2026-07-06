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

// I9: one plain-English sentence per status code, shown via AdminTermHint so
// non-technical operators understand what each redirect type does without
// having to know HTTP status semantics. Presentation only — the underlying
// status codes and validation are unchanged.
const REDIRECT_STATUS_PLAIN_EXPLANATIONS: Record<number, string> = {
  301: "Moved permanently. Browsers and Google remember the new address.",
  302: "Moved temporarily. Browsers and Google keep checking the old address.",
  307: "Temporary redirect that keeps the original request method (rarely needed for pages).",
  308: "Permanent redirect that keeps the original request method (rarely needed for pages).",
};

export function redirectStatusPlainExplanation(code: number): string {
  return (
    REDIRECT_STATUS_PLAIN_EXPLANATIONS[code] ??
    "A redirect that sends visitors from the old address to the new one."
  );
}
