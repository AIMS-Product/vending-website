import { ACCEPTED_SOURCES } from "@/lib/booked-calls-v2/rules";

/**
 * V2 original-source resolution (memo §6): a valid Funnel Name wins; else the
 * contacts' UTMs when they agree; else Resource Tag; else Unknown. Never
 * guessed, never written back to Close.
 *
 * ponytail: the UTM and Resource Tag maps below are ours, built from the
 * labels in Appendix B; Dom's `sources.py` mapping is not shared yet. Swap in
 * his table when it is.
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

const ACCEPTED = new Map(ACCEPTED_SOURCES.map((s) => [s.toLowerCase(), s]));

const PAID = /^(cpc|ppc|paid|paid[-_ ]?social|ads?)$/i;

/** utm_source (lowercased) -> accepted label; paid medium may switch it. */
function labelForUtm(source: string, medium: string): string | null {
  const s = source.trim().toLowerCase();
  const paid = PAID.test(medium.trim());
  if (!s) return null;
  if (/^(youtube|yt)$/.test(s)) return paid ? "YouTube Ads" : "YouTube";
  if (/^(google|adwords)$/.test(s)) return paid ? "Google Ads" : "Search - OG";
  if (/^(meta|facebook|fb)$/.test(s)) return paid ? "Meta Ads" : null;
  if (/^(instagram|ig)$/.test(s)) return paid ? "Meta Ads" : "Instagram";
  if (/^(linkedin|li)$/.test(s)) return paid ? "LinkedIn Ads" : "Linkedin";
  if (/^(tiktok|tt)$/.test(s)) return "TikTok";
  if (/^(x|twitter)$/.test(s)) return "X";
  if (/webinar/.test(s)) return "Internal Webinar";
  if (/^(website|vendingpreneurs|vendingpreneurs\.com|chatbot)$/.test(s))
    return "Website";
  if (s === "vsl") return "VSL";
  if (/newsletter/.test(s)) return "Mike Newsletter";
  if (s === "affiliate") return "Affiliate";
  return ACCEPTED.get(s) ?? null;
}

function labelForResourceTag(tag: string): string | null {
  const t = tag.toLowerCase();
  if (/webinar|masterclass/.test(t)) return "Internal Webinar";
  if (/website|chatbot|application/.test(t)) return "Website";
  return null;
}

export function resolveOrigin(facts: LeadOriginFacts | undefined): Origin {
  if (!facts) return { source: null, basis: "unknown" };
  const funnel = ACCEPTED.get((facts.funnel ?? "").trim().toLowerCase());
  if (funnel) return { source: funnel, basis: "funnel" };

  const fromUtms = new Set(
    facts.contactUtms
      .map((u) => labelForUtm(u.source ?? "", u.medium ?? ""))
      .filter((label): label is string => Boolean(label)),
  );
  // Competing contact evidence stays unknown rather than picking a winner.
  if (fromUtms.size === 1)
    return { source: [...fromUtms][0], basis: "contact_utm" };
  if (fromUtms.size > 1) return { source: null, basis: "unknown" };

  const tag = facts.resourceTag ? labelForResourceTag(facts.resourceTag) : null;
  if (tag) return { source: tag, basis: "resource_tag" };
  return { source: null, basis: "unknown" };
}
