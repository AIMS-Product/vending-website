import domRules from "@/lib/booked-calls-v2/rules.v2.6-any-meeting-clock.json";

/** Canonical source resolution: lead funnel, then unambiguous contact UTM source. */

export type OriginBasis = "funnel" | "contact_utm" | "unknown";
export type Origin = { source: string | null; basis: OriginBasis };

export type LeadOriginFacts = {
  funnel: string | null;
  contactUtms: ReadonlyArray<{ source?: string | null }>;
};

const LABELS = new Map(
  domRules.marketing_sources.map((label) => [label.toLowerCase(), label]),
);
const UTM_SOURCE_MAP: Readonly<Record<string, string>> =
  domRules.utm_source_map;

/** `custom_value` in sources.py: trimmed, empty as missing. */
const clean = (value: string | null | undefined): string | null =>
  value?.trim() || null;

/** A contact `utm_source` as sources.py keys it: lower case, query cut off. */
export function utmSourceKey(value: string | null | undefined): string | null {
  const raw = clean(value);
  return raw ? raw.toLowerCase().split("&", 1)[0]!.split("?", 1)[0]! : null;
}

export function resolveOrigin(facts: LeadOriginFacts | undefined): Origin {
  if (!facts) return { source: null, basis: "unknown" };
  const current = clean(facts.funnel);
  const canonical = current ? LABELS.get(current.toLowerCase()) : undefined;
  if (canonical) return { source: canonical, basis: "funnel" };

  const candidates = new Set<string>();
  let unknownUtm = false;
  for (const contact of facts.contactUtms) {
    const source = utmSourceKey(contact.source);
    if (source === null) continue;
    const target = UTM_SOURCE_MAP[source];
    if (target) candidates.add(target);
    else unknownUtm = true;
  }
  if (candidates.size === 1 && !unknownUtm)
    return { source: [...candidates][0]!, basis: "contact_utm" };
  return { source: null, basis: "unknown" };
}
