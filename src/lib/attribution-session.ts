import {
  buildLeadAttribution,
  type LeadAttribution,
} from "@/lib/lead-attribution";

export const VP_ATTRIBUTION_STORAGE_KEY = "vp_attr";
export const VP_SESSION_COOKIE_NAME = "vp_sid";

export type AttributionSession = {
  version: 1;
  vp_session_id: string;
  first_landing_url: string;
  first_landing_path: string;
  first_referrer: string;
  first_touch_at: string;
  latest_landing_url: string;
  latest_landing_path: string;
  latest_referrer: string;
  latest_touch_at: string;
} & Partial<
  Pick<
    LeadAttribution,
    | "utm_source"
    | "utm_medium"
    | "utm_campaign"
    | "utm_term"
    | "utm_content"
    | "gclid"
    | "fbclid"
    | "gbraid"
    | "wbraid"
    | "paid_platform"
    | "paid_source_key"
    | "campaign_id"
    | "campaign_name"
    | "adset_id"
    | "adset_name"
    | "ad_group_id"
    | "ad_group_name"
    | "group_id"
    | "group_name"
    | "ad_id"
    | "ad_name"
  >
>;

const ATTRIBUTION_VALUE_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
  "paid_platform",
  "paid_source_key",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_group_id",
  "ad_group_name",
  "group_id",
  "group_name",
  "ad_id",
  "ad_name",
] as const;

const SESSION_VALUE_FIELDS = [
  "first_landing_url",
  "first_landing_path",
  "first_referrer",
  "first_touch_at",
  "latest_landing_url",
  "latest_landing_path",
  "latest_referrer",
  "latest_touch_at",
] as const;

const ATTRIBUTION_SIGNAL_FIELDS = [
  ...ATTRIBUTION_VALUE_FIELDS,
  "source_path",
  "source_page_id",
  "source_page_slug",
  "source_block_id",
  "source_cta_tracking_name",
  "clicked_href",
] as const;

type AttributionSessionInput = {
  href: string;
  referrer?: string;
  existing?: AttributionSession | null;
  nowIso: string;
  sessionIdFactory: () => string;
};

export function parseAttributionSession(
  value: string | null | undefined,
): AttributionSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AttributionSession>;
    if (
      parsed.version !== 1 ||
      typeof parsed.vp_session_id !== "string" ||
      !parsed.vp_session_id
    ) {
      return null;
    }
    return {
      version: 1,
      vp_session_id: parsed.vp_session_id,
      first_landing_url: stringValue(parsed.first_landing_url),
      first_landing_path: stringValue(parsed.first_landing_path),
      first_referrer: stringValue(parsed.first_referrer),
      first_touch_at: stringValue(parsed.first_touch_at),
      latest_landing_url: stringValue(parsed.latest_landing_url),
      latest_landing_path: stringValue(parsed.latest_landing_path),
      latest_referrer: stringValue(parsed.latest_referrer),
      latest_touch_at: stringValue(parsed.latest_touch_at),
      ...Object.fromEntries(
        ATTRIBUTION_VALUE_FIELDS.map((field) => [
          field,
          stringValue(parsed[field]),
        ]).filter(([, fieldValue]) => fieldValue),
      ),
    };
  } catch {
    return null;
  }
}

export function serializeAttributionSession(session: AttributionSession) {
  return JSON.stringify(session);
}

export function updateAttributionSessionFromPage({
  href,
  referrer = "",
  existing,
  nowIso,
  sessionIdFactory,
}: AttributionSessionInput): AttributionSession {
  const url = new URL(href);
  const pageAttribution = buildLeadAttribution(
    Object.fromEntries(url.searchParams.entries()),
    url.pathname,
  );
  const sessionId =
    pageAttribution.vp_session_id ||
    existing?.vp_session_id ||
    sessionIdFactory();
  const isNewTouch =
    !existing ||
    hasAttributionSignal(url.searchParams) ||
    isExternalReferrer(referrer, url.origin);

  if (!existing) {
    return {
      version: 1,
      vp_session_id: sessionId,
      first_landing_url: currentUrl(url),
      first_landing_path: url.pathname,
      first_referrer: referrer,
      first_touch_at: nowIso,
      latest_landing_url: currentUrl(url),
      latest_landing_path: url.pathname,
      latest_referrer: referrer,
      latest_touch_at: nowIso,
      ...sessionAttributionValues(pageAttribution),
    };
  }

  const next: AttributionSession = {
    ...existing,
    vp_session_id: sessionId,
    first_landing_url: existing.first_landing_url || currentUrl(url),
    first_landing_path: existing.first_landing_path || url.pathname,
    first_referrer: existing.first_referrer,
    first_touch_at: existing.first_touch_at || nowIso,
  };

  if (isNewTouch) {
    next.latest_landing_url = currentUrl(url);
    next.latest_landing_path = url.pathname;
    next.latest_referrer = referrer;
    next.latest_touch_at = nowIso;
  }

  Object.assign(next, compactAttributionValues(pageAttribution));
  return next;
}

export function mergeLeadAttributionWithSession(
  base: LeadAttribution,
  session: AttributionSession | null,
): LeadAttribution {
  if (!session) return base;

  const merged: LeadAttribution = { ...base };
  if (!merged.vp_session_id) merged.vp_session_id = session.vp_session_id;

  for (const field of SESSION_VALUE_FIELDS) {
    if (!merged[field]) merged[field] = session[field] ?? "";
  }

  const baseSourceIsFallback =
    merged.source_path &&
    merged.landing_path &&
    merged.source_path === merged.landing_path;
  if (baseSourceIsFallback && session.latest_landing_path) {
    merged.source_path = session.latest_landing_path;
  }
  if (!merged.referrer) {
    merged.referrer = session.latest_referrer || session.first_referrer || "";
  }

  for (const field of ATTRIBUTION_VALUE_FIELDS) {
    if (!merged[field]) merged[field] = session[field] ?? "";
  }

  return merged;
}

function hasAttributionSignal(params: URLSearchParams) {
  return ATTRIBUTION_SIGNAL_FIELDS.some((field) => {
    const value = params.get(field);
    return Boolean(value && value.trim());
  });
}

function sessionAttributionValues(attribution: LeadAttribution) {
  return Object.fromEntries(
    ATTRIBUTION_VALUE_FIELDS.map((field) => [field, attribution[field]]),
  );
}

function compactAttributionValues(attribution: LeadAttribution) {
  return Object.fromEntries(
    ATTRIBUTION_VALUE_FIELDS.map((field) => [field, attribution[field]]).filter(
      ([, value]) => value,
    ),
  );
}

function currentUrl(url: URL) {
  return `${url.origin}${url.pathname}${url.search}`;
}

function isExternalReferrer(referrer: string, currentOrigin: string) {
  if (!referrer) return false;
  try {
    return new URL(referrer).origin !== currentOrigin;
  } catch {
    return false;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
