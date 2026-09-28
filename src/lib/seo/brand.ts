/**
 * Searches for the brand itself. Matched on the query with spaces removed, so
 * "vending preneurs", "vendingprenuers" and "mike hoffman vending machine"
 * all count. Taken from the live query report on 2026-09-28; add a term here
 * when a new spelling shows up in the Keywords tab.
 */
const BRAND_PATTERNS: readonly RegExp[] = [
  /vendingpre?n[eu]+rs?/, // vendingpreneurs, vendingprenuers, vendingpreneur
  /vendingprenur/,
  /mikehoff?mann?/,
  /modernamenities/,
  /vendhub/,
  /theroutenewsletter/,
];

export function isBrandQuery(query: string): boolean {
  const squashed = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  return BRAND_PATTERNS.some((pattern) => pattern.test(squashed));
}
