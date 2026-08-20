// Mirrors news-slug.ts: ONE URL-safe slug normalizer shared by the case
// study editor (client, on every keystroke) and the case study save action
// (server, as the authoritative guard). Lowercase, a-z0-9 and single
// hyphens, no leading/trailing hyphen.

export function normalizeCaseStudySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
