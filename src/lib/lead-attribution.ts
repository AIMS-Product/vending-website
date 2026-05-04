export type LeadAttribution = {
  source_path: string;
  landing_path: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
};

export type LeadSearchParams = Record<string, string | string[] | undefined>;

export function buildLeadAttribution(
  searchParams: LeadSearchParams,
  landingPath: string,
): LeadAttribution {
  return {
    source_path:
      firstParam(searchParams.source_path) ??
      firstParam(searchParams.source) ??
      landingPath,
    landing_path: landingPath,
    referrer: firstParam(searchParams.referrer) ?? "",
    utm_source: firstParam(searchParams.utm_source) ?? "",
    utm_medium: firstParam(searchParams.utm_medium) ?? "",
    utm_campaign: firstParam(searchParams.utm_campaign) ?? "",
    utm_term: firstParam(searchParams.utm_term) ?? "",
    utm_content: firstParam(searchParams.utm_content) ?? "",
  };
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || undefined;
  return value || undefined;
}
