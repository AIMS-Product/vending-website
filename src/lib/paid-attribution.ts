export type PaidPlatform = "google_ads" | "meta_ads";
export type AttributionChannel =
  | PaidPlatform
  | "youtube"
  | "email"
  | "social"
  | "referral"
  | "direct";

export type PaidAttributionInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  paidPlatform?: string | null;
  paidSourceKey?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  adGroupId?: string | null;
  adGroupName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  adId?: string | null;
  adName?: string | null;
};

export type AttributionChannelInput = PaidAttributionInput & {
  referrer?: string | null;
  latestReferrer?: string | null;
};

const GOOGLE_PLATFORM_NAMES = new Set(["google", "google_ads", "googleads"]);
const META_PLATFORM_NAMES = new Set([
  "meta",
  "meta_ads",
  "facebook",
  "facebook_ads",
  "instagram",
]);
const PLATFORM_RULES = [
  {
    platform: "google_ads",
    names: GOOGLE_PLATFORM_NAMES,
    signalKeys: ["gclid", "gbraid", "wbraid", "adGroupId"],
    sourceTerms: ["google"],
  },
  {
    platform: "meta_ads",
    names: META_PLATFORM_NAMES,
    signalKeys: ["fbclid", "adsetId"],
    sourceTerms: ["meta", "facebook", "instagram"],
  },
] as const satisfies Array<{
  platform: PaidPlatform;
  names: ReadonlySet<string>;
  signalKeys: readonly (keyof PaidAttributionInput)[];
  sourceTerms: readonly string[];
}>;

export function buildPaidAttributionProperties(
  input: PaidAttributionInput,
): Record<string, string> {
  const platform = normalizedPaidPlatform(input);
  const groupId =
    input.groupId ??
    (platform === "google_ads" ? input.adGroupId : null) ??
    (platform === "meta_ads" ? input.adsetId : null);
  const groupName =
    input.groupName ??
    (platform === "google_ads" ? input.adGroupName : null) ??
    (platform === "meta_ads" ? input.adsetName : null);

  return compactObject({
    gclid: input.gclid,
    fbclid: input.fbclid,
    gbraid: input.gbraid,
    wbraid: input.wbraid,
    paid_platform: platform ?? input.paidPlatform,
    paid_source_key:
      input.paidSourceKey ?? inferredPaidSourceKey(input, platform),
    campaign_id: input.campaignId,
    campaign_name: input.campaignName,
    adset_id: input.adsetId,
    adset_name: input.adsetName,
    ad_group_id: input.adGroupId,
    ad_group_name: input.adGroupName,
    group_id: groupId,
    group_name: groupName,
    ad_id: input.adId,
    ad_name: input.adName,
  });
}

export function paidAttributionMetadata(
  input: PaidAttributionInput,
): Record<string, Record<string, string>> {
  const paidAttribution = buildPaidAttributionProperties(input);
  return Object.keys(paidAttribution).length
    ? { paid_attribution: paidAttribution }
    : {};
}

function normalizedPaidPlatform(
  input: PaidAttributionInput,
): PaidPlatform | null {
  return (
    normalizePlatformName(input.paidPlatform) ??
    PLATFORM_RULES.find((rule) => hasPlatformSignals(input, rule))?.platform ??
    null
  );
}

export function channelFromAttributionSignals(
  input: AttributionChannelInput,
): AttributionChannel {
  const paidPlatform = normalizedPaidPlatform(input);
  if (paidPlatform) return paidPlatform;

  const source =
    `${input.utmSource ?? ""} ${input.utmMedium ?? ""}`.toLowerCase();
  if (source.includes("cpc")) return "google_ads";
  if (source.includes("youtube")) return "youtube";
  if (source.includes("email")) return "email";
  if (source.includes("social")) return "social";
  if (input.referrer || input.latestReferrer) return "referral";
  return "direct";
}

function inferredPaidSourceKey(
  input: PaidAttributionInput,
  platform: PaidPlatform | null = normalizedPaidPlatform(input),
) {
  const groupId = platform ? paidSourceGroupId(input, platform) : null;
  return platform && input.campaignId && groupId && input.adId
    ? [platform, input.campaignId, groupId, input.adId].join(":")
    : null;
}

function normalizePlatformName(value?: string | null): PaidPlatform | null {
  const normalized = value?.toLowerCase().replaceAll("-", "_");
  if (!normalized) return null;
  return (
    PLATFORM_RULES.find((rule) => rule.names.has(normalized))?.platform ?? null
  );
}

function hasPlatformSignals(
  input: PaidAttributionInput,
  rule: (typeof PLATFORM_RULES)[number],
) {
  return (
    rule.signalKeys.some((key) => Boolean(input[key])) ||
    includesAny(sourceText(input), rule.sourceTerms)
  );
}

function paidSourceGroupId(
  input: PaidAttributionInput,
  platform: PaidPlatform,
) {
  return platform === "meta_ads"
    ? input.adsetId
    : (input.adGroupId ?? input.groupId);
}

function sourceText(input: PaidAttributionInput) {
  return `${input.utmSource ?? ""} ${input.utmMedium ?? ""}`.toLowerCase();
}

function includesAny(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

function compactObject(
  input: Record<string, string | null | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    ),
  ) as Record<string, string>;
}
