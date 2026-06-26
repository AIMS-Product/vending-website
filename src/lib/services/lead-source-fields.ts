import { z } from "zod";

export type LeadSourceInputFields = {
  vpSessionId?: unknown;
  sourcePath?: unknown;
  landingPath?: unknown;
  referrer?: unknown;
  firstLandingUrl?: unknown;
  firstLandingPath?: unknown;
  firstReferrer?: unknown;
  firstTouchAt?: unknown;
  latestLandingUrl?: unknown;
  latestLandingPath?: unknown;
  latestReferrer?: unknown;
  latestTouchAt?: unknown;
  userAgent?: unknown;
  sourcePageId?: unknown;
  sourcePageSlug?: unknown;
  targetKeyword?: unknown;
  sourceBlockId?: unknown;
  sourceCtaTrackingName?: unknown;
  clickedHref?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
  gclid?: unknown;
  fbclid?: unknown;
  gbraid?: unknown;
  wbraid?: unknown;
  paidPlatform?: unknown;
  paidSourceKey?: unknown;
  campaignId?: unknown;
  campaignName?: unknown;
  adsetId?: unknown;
  adsetName?: unknown;
  adGroupId?: unknown;
  adGroupName?: unknown;
  groupId?: unknown;
  groupName?: unknown;
  adId?: unknown;
  adName?: unknown;
};

export const requiredText = (label: string, max: number) =>
  z.preprocess(
    stringifyFormValue,
    z
      .string()
      .trim()
      .min(1, `${label} is required.`)
      .max(max, `${label} is too long.`),
  );

export const optionalText = (label: string, max: number) =>
  z
    .preprocess(
      stringifyFormValue,
      z.string().trim().max(max, `${label} is too long.`),
    )
    .transform((value) => (value.length > 0 ? value : null))
    .optional()
    .transform((value) => value ?? null);

export const emailText = () =>
  z
    .preprocess(stringifyFormValue, z.email())
    .transform((value) => value.toLowerCase());

export const leadSourceSchemaFields = {
  vpSessionId: optionalText("Vendingpreneurs session ID", 160),
  sourcePath: optionalText("Source path", 500),
  landingPath: optionalText("Landing path", 500),
  referrer: optionalText("Referrer", 1000),
  firstLandingUrl: optionalText("First landing URL", 1200),
  firstLandingPath: optionalText("First landing path", 500),
  firstReferrer: optionalText("First referrer", 1000),
  firstTouchAt: optionalText("First touch timestamp", 80),
  latestLandingUrl: optionalText("Latest landing URL", 1200),
  latestLandingPath: optionalText("Latest landing path", 500),
  latestReferrer: optionalText("Latest referrer", 1000),
  latestTouchAt: optionalText("Latest touch timestamp", 80),
  userAgent: optionalText("User agent", 1000),
  sourcePageId: optionalText("Source page ID", 80),
  sourcePageSlug: optionalText("Source page slug", 160),
  targetKeyword: optionalText("Target keyword", 180),
  sourceBlockId: optionalText("Source block ID", 120),
  sourceCtaTrackingName: optionalText("Source CTA tracking name", 160),
  clickedHref: optionalText("Clicked href", 500),
  utmSource: optionalText("UTM source", 160),
  utmMedium: optionalText("UTM medium", 160),
  utmCampaign: optionalText("UTM campaign", 200),
  utmTerm: optionalText("UTM term", 200),
  utmContent: optionalText("UTM content", 200),
  gclid: optionalText("Google click ID", 300),
  fbclid: optionalText("Meta click ID", 500),
  gbraid: optionalText("Google gbraid", 300),
  wbraid: optionalText("Google wbraid", 300),
  paidPlatform: optionalText("Paid platform", 80),
  paidSourceKey: optionalText("Paid source key", 300),
  campaignId: optionalText("Campaign ID", 200),
  campaignName: optionalText("Campaign name", 300),
  adsetId: optionalText("Ad set ID", 200),
  adsetName: optionalText("Ad set name", 300),
  adGroupId: optionalText("Ad group ID", 200),
  adGroupName: optionalText("Ad group name", 300),
  groupId: optionalText("Ad group/ad set ID", 200),
  groupName: optionalText("Ad group/ad set name", 300),
  adId: optionalText("Ad ID", 200),
  adName: optionalText("Ad name", 300),
} as const;

function stringifyFormValue(value: unknown) {
  if (value == null) return "";
  return String(value);
}
