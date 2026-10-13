/**
 * Pure helpers for scripts/backfill-marketing-links.mjs: turn every UTM tag
 * we have already seen into one registry row per distinct five-tag link.
 *
 * Mirrors `utmTupleKey` and `IMPORTED_LINK_PREFIX` in
 * src/lib/analytics/link-standard.ts (the app's copy). A script cannot import
 * the TS module, so the test pins both copies to the same behaviour.
 */

export const IMPORTED_LINK_PREFIX = "backfill:";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

/** Lower number wins when two origins saw the same link: a real URL beats a tag. */
export const ORIGIN_PRIORITY = {
  "webinar-links": 1,
  youtube: 2,
  "social-posts": 3,
  leads: 4,
  calendly: 5,
};

/** Our own QA and review tags, never published links. */
const SKIP_SOURCES = new Set(["qa", "team-review", "test"]);

/**
 * A tag value or null. Blank, the Calendly link template's literal "_____"
 * (351 bookings) and unfilled `{{merge}}` fields are not tags.
 */
export function cleanTag(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^_+$/.test(trimmed) || trimmed.includes("{{")) return null;
  return trimmed;
}

export function tupleOf(row) {
  return {
    source: cleanTag(row.utm_source),
    medium: cleanTag(row.utm_medium),
    campaign: cleanTag(row.utm_campaign),
    content: cleanTag(row.utm_content),
    term: cleanTag(row.utm_term),
  };
}

export function tupleKey(t) {
  return [t.source, t.medium, t.campaign, t.content, t.term]
    .map((value) => value?.trim().toLowerCase() ?? "")
    .join("\u0000");
}

export function isTagged(t) {
  return Boolean(t.source || t.medium || t.campaign || t.content || t.term);
}

/** The UTMs off a URL plus the URL with them removed, or null if not a URL. */
export function splitUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const row = {};
  for (const key of UTM_KEYS) {
    row[key] = parsed.searchParams.get(key);
    parsed.searchParams.delete(key);
  }
  return { tuple: tupleOf(row), baseUrl: parsed.toString() };
}

/** The base URL with whichever tags the link carried, in standard order. */
export function buildUrl(baseUrl, t) {
  const url = new URL(baseUrl);
  const pairs = [
    ["utm_source", t.source],
    ["utm_medium", t.medium],
    ["utm_campaign", t.campaign],
    ["utm_content", t.content],
    ["utm_term", t.term],
  ];
  for (const [key, value] of pairs) if (value) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * One candidate per distinct link. Keeps the highest-priority origin's URL
 * and label, the earliest sighting, and drops anything the registry already
 * holds (`existingKeys`) or that carries no tag at all.
 */
export function mergeCandidates(candidates, existingKeys) {
  const byKey = new Map();
  for (const candidate of candidates) {
    if (!isTagged(candidate.tuple)) continue;
    if (SKIP_SOURCES.has(candidate.tuple.source?.toLowerCase() ?? "")) continue;
    const key = tupleKey(candidate.tuple);
    if (existingKeys.has(key)) continue;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...candidate });
      continue;
    }
    const better =
      ORIGIN_PRIORITY[candidate.origin] < ORIGIN_PRIORITY[current.origin];
    const firstSeen = earliest(current.firstSeen, candidate.firstSeen);
    byKey.set(
      key,
      better ? { ...candidate, firstSeen } : { ...current, firstSeen },
    );
  }
  return [...byKey.values()];
}

/** The `marketing_links` insert. Missing tags are '' (the columns are not null). */
export function toRow(candidate) {
  const t = candidate.tuple;
  return {
    url: buildUrl(candidate.baseUrl, t),
    base_url: candidate.baseUrl,
    utm_source: t.source ?? "",
    utm_medium: t.medium ?? "",
    utm_campaign: t.campaign ?? "",
    utm_content: t.content ?? "",
    utm_term: t.term ?? "",
    label: candidate.label ?? null,
    bitly_id: candidate.bitlyId ?? null,
    bitly_url: candidate.bitlyUrl ?? null,
    created_by: `${IMPORTED_LINK_PREFIX}${candidate.origin}`,
    ...(candidate.firstSeen ? { created_at: candidate.firstSeen } : {}),
  };
}

/** Most frequent value, ties to the first seen. */
export function mostCommon(values) {
  const counts = new Map();
  for (const value of values)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = null;
  for (const [value, count] of counts)
    if (!best || count > best[1]) best = [value, count];
  return best?.[0] ?? null;
}

function earliest(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}
