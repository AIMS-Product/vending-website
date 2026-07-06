// I13: ONE URL-safe slug normalizer shared by the news editor (client, on every
// keystroke) and the news save action (server, as the authoritative guard). The
// review typed "Invalid Slug With Spaces!!" and it was accepted, so the server
// must never trust the client's slugification — it normalizes the raw value the
// same way here and only rejects when nothing URL-safe survives. Lowercase,
// a-z0-9 and single hyphens, no leading/trailing hyphen.

export function normalizeNewsSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
