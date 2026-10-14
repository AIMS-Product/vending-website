import domRules from "@/lib/booked-calls-v2/rules.v2.2.json";

/**
 * V2 original-source resolution, a line-for-line port of Dom's `sources.py`
 * from the immutable booked_calls.v2.2 artifact (received 2026-10-14), driven
 * by his `rules.json` vendored verbatim beside this file (SHA-256 6949a5ee…
 * 581a, pinned in sources.test.ts). Do not edit the JSON: a new rule version
 * is a new file.
 *
 * A valid Funnel Name wins; else every contact UTM must map, and to one
 * label (an unmapped or conflicting UTM leaves the source unresolved, so the
 * call is held); else Resource Tag; else unavailable. Never guessed, never
 * written back to Close.
 */

export type OriginBasis = "funnel" | "contact_utm" | "resource_tag" | "unknown";
export type Origin = { source: string | null; basis: OriginBasis };

export type LeadOriginFacts = {
  funnel: string | null;
  contactUtms: ReadonlyArray<{
    source?: string | null;
    medium?: string | null;
  }>;
  resourceTag: string | null;
};

const LABELS = new Map(
  domRules.marketing_sources.map((label) => [label.toLowerCase(), label]),
);
const UTM_SOURCE_MAP: Readonly<Record<string, string>> =
  domRules.utm_source_map;
const MEDIUM_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = domRules.source_medium_overrides;
const RESOURCE_TAG_MAP: Readonly<Record<string, string>> =
  domRules.resource_tag_map;

/** `custom_value` in sources.py: trimmed, empty as missing. */
const clean = (value: string | null | undefined): string | null =>
  value?.trim() || null;

export function resolveOrigin(facts: LeadOriginFacts | undefined): Origin {
  if (!facts) return { source: null, basis: "unknown" };
  const current = clean(facts.funnel);
  const canonical = current ? LABELS.get(current.toLowerCase()) : undefined;
  if (canonical) return { source: canonical, basis: "funnel" };

  const candidates = new Set<string>();
  let unknownUtm = false;
  for (const contact of facts.contactUtms) {
    const raw = clean(contact.source);
    if (!raw) continue;
    const source = raw.toLowerCase().split("&", 1)[0]!.split("?", 1)[0]!;
    const medium = (clean(contact.medium) ?? "").toLowerCase();
    const target = MEDIUM_OVERRIDES[source]?.[medium] || UTM_SOURCE_MAP[source];
    if (target) candidates.add(target);
    else unknownUtm = true;
  }
  if (candidates.size === 1 && !unknownUtm)
    return { source: [...candidates][0]!, basis: "contact_utm" };
  if (candidates.size > 0 || unknownUtm)
    return { source: null, basis: "unknown" };

  const tag = clean(facts.resourceTag);
  const fromTag = tag ? RESOURCE_TAG_MAP[tag] : undefined;
  if (fromTag) return { source: fromTag, basis: "resource_tag" };
  return { source: null, basis: "unknown" };
}
