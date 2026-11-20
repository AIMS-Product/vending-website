const BRAND_SUFFIX_PATTERN = /\s*\|\s*Vendingpreneurs\s*$/i;

export function normalizeBrandedPageTitle(title: string) {
  const trimmed = title.trim();
  const normalized = trimmed.replace(BRAND_SUFFIX_PATTERN, "").trim();
  return normalized || trimmed;
}

// Root layout template appends " | Vendingpreneurs". Keep it only where it
// fits: a title over 45 characters, or one that already names the brand
// anywhere, is used as is (Semrush: 29 titles over 70 characters, two with
// the brand twice).
const SUFFIX_MAX_TITLE_LENGTH = 45;

export function pageTitle(raw: string): string | { absolute: string } {
  const title = normalizeBrandedPageTitle(raw);
  return title.length > SUFFIX_MAX_TITLE_LENGTH ||
    /vendingpreneurs/i.test(title)
    ? { absolute: title }
    : title;
}
