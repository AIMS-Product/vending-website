const BRAND_SUFFIX_PATTERN = /\s*\|\s*Vendingpreneurs\s*$/i;

export function normalizeBrandedPageTitle(title: string) {
  const trimmed = title.trim();
  const normalized = trimmed.replace(BRAND_SUFFIX_PATTERN, "").trim();
  return normalized || trimmed;
}
