import "server-only";
import { z } from "zod";

const optionalEnv = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalTrimmedOptionalEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

const optionalTrimmedEnv = (fallback: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).default(fallback),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().trim().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RESEND_API_KEY: optionalEnv,
  LEAD_NOTIFICATION_TO: optionalEnv,
  LEAD_NOTIFICATION_FROM: optionalEnv,
  LEAD_NOTIFICATION_SUBJECT_PREFIX: optionalEnv,
  SLACK_WEBHOOK_URL: optionalEnv,
  MONEY_PAGE_INGEST_URL: optionalTrimmedOptionalEnv,
  MONEY_PAGE_SECRET: optionalTrimmedOptionalEnv,
  CRON_SECRET: optionalTrimmedOptionalEnv,
  CLOSE_API_KEY: optionalTrimmedOptionalEnv,
  CLOSE_API_BASE_URL: optionalTrimmedOptionalEnv,
  CLOSE_LEAD_STATUS_ID: optionalTrimmedOptionalEnv,
  CLOSE_FOLLOW_UP_ASSIGNED_TO: optionalTrimmedOptionalEnv,
  CLOSE_QUALIFICATION_STATUS_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_VP_SESSION_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_SOURCE_PATH_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_LANDING_PATH_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_FIRST_LANDING_URL_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_FIRST_LANDING_PATH_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_FIRST_REFERRER_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_LATEST_LANDING_URL_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_LATEST_LANDING_PATH_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_LATEST_REFERRER_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_SOURCE_PAGE_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_SOURCE_PAGE_SLUG_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_TARGET_KEYWORD_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_SOURCE_BLOCK_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_CLICKED_HREF_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_UTM_SOURCE_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_UTM_MEDIUM_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_UTM_CAMPAIGN_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_UTM_TERM_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_UTM_CONTENT_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_GCLID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_FBCLID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_GBRAID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_WBRAID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_PAID_PLATFORM_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_PAID_SOURCE_KEY_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_CAMPAIGN_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_CAMPAIGN_NAME_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_ADSET_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_ADSET_NAME_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_AD_GROUP_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_AD_GROUP_NAME_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_GROUP_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_GROUP_NAME_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_AD_ID_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_AD_NAME_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_EXPERIMENT_KEY_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_VARIANT_KEY_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_STATE_MARKET_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_BUSINESS_STAGE_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_BUDGET_RANGE_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_AVAILABLE_CAPITAL_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_PURCHASE_TIMELINE_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_LOCATION_STATUS_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_MACHINE_GOAL_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_PRIMARY_GOAL_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_CONSENT_STATUS_FIELD_ID: optionalTrimmedOptionalEnv,
  CLOSE_LATEST_COMPLETED_AT_FIELD_ID: optionalTrimmedOptionalEnv,
  OPENAI_API_KEY: optionalEnv,
  OPENAI_SEO_MODEL: optionalTrimmedEnv("gpt-5.5"),
  OPENAI_SEO_REASONING_EFFORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
      .default("medium"),
  ),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  LEAD_NOTIFICATION_TO: process.env.LEAD_NOTIFICATION_TO,
  LEAD_NOTIFICATION_FROM: process.env.LEAD_NOTIFICATION_FROM,
  LEAD_NOTIFICATION_SUBJECT_PREFIX:
    process.env.LEAD_NOTIFICATION_SUBJECT_PREFIX,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  MONEY_PAGE_INGEST_URL: process.env.MONEY_PAGE_INGEST_URL,
  MONEY_PAGE_SECRET: process.env.MONEY_PAGE_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  CLOSE_API_KEY: process.env.CLOSE_API_KEY,
  CLOSE_API_BASE_URL: process.env.CLOSE_API_BASE_URL,
  CLOSE_LEAD_STATUS_ID: process.env.CLOSE_LEAD_STATUS_ID,
  CLOSE_FOLLOW_UP_ASSIGNED_TO: process.env.CLOSE_FOLLOW_UP_ASSIGNED_TO,
  CLOSE_QUALIFICATION_STATUS_FIELD_ID:
    process.env.CLOSE_QUALIFICATION_STATUS_FIELD_ID,
  CLOSE_VP_SESSION_ID_FIELD_ID: process.env.CLOSE_VP_SESSION_ID_FIELD_ID,
  CLOSE_SOURCE_PATH_FIELD_ID: process.env.CLOSE_SOURCE_PATH_FIELD_ID,
  CLOSE_LANDING_PATH_FIELD_ID: process.env.CLOSE_LANDING_PATH_FIELD_ID,
  CLOSE_FIRST_LANDING_URL_FIELD_ID:
    process.env.CLOSE_FIRST_LANDING_URL_FIELD_ID,
  CLOSE_FIRST_LANDING_PATH_FIELD_ID:
    process.env.CLOSE_FIRST_LANDING_PATH_FIELD_ID,
  CLOSE_FIRST_REFERRER_FIELD_ID: process.env.CLOSE_FIRST_REFERRER_FIELD_ID,
  CLOSE_LATEST_LANDING_URL_FIELD_ID:
    process.env.CLOSE_LATEST_LANDING_URL_FIELD_ID,
  CLOSE_LATEST_LANDING_PATH_FIELD_ID:
    process.env.CLOSE_LATEST_LANDING_PATH_FIELD_ID,
  CLOSE_LATEST_REFERRER_FIELD_ID: process.env.CLOSE_LATEST_REFERRER_FIELD_ID,
  CLOSE_SOURCE_PAGE_ID_FIELD_ID: process.env.CLOSE_SOURCE_PAGE_ID_FIELD_ID,
  CLOSE_SOURCE_PAGE_SLUG_FIELD_ID: process.env.CLOSE_SOURCE_PAGE_SLUG_FIELD_ID,
  CLOSE_TARGET_KEYWORD_FIELD_ID: process.env.CLOSE_TARGET_KEYWORD_FIELD_ID,
  CLOSE_SOURCE_BLOCK_ID_FIELD_ID: process.env.CLOSE_SOURCE_BLOCK_ID_FIELD_ID,
  CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID:
    process.env.CLOSE_SOURCE_CTA_TRACKING_NAME_FIELD_ID,
  CLOSE_CLICKED_HREF_FIELD_ID: process.env.CLOSE_CLICKED_HREF_FIELD_ID,
  CLOSE_UTM_SOURCE_FIELD_ID: process.env.CLOSE_UTM_SOURCE_FIELD_ID,
  CLOSE_UTM_MEDIUM_FIELD_ID: process.env.CLOSE_UTM_MEDIUM_FIELD_ID,
  CLOSE_UTM_CAMPAIGN_FIELD_ID: process.env.CLOSE_UTM_CAMPAIGN_FIELD_ID,
  CLOSE_UTM_TERM_FIELD_ID: process.env.CLOSE_UTM_TERM_FIELD_ID,
  CLOSE_UTM_CONTENT_FIELD_ID: process.env.CLOSE_UTM_CONTENT_FIELD_ID,
  CLOSE_GCLID_FIELD_ID: process.env.CLOSE_GCLID_FIELD_ID,
  CLOSE_FBCLID_FIELD_ID: process.env.CLOSE_FBCLID_FIELD_ID,
  CLOSE_GBRAID_FIELD_ID: process.env.CLOSE_GBRAID_FIELD_ID,
  CLOSE_WBRAID_FIELD_ID: process.env.CLOSE_WBRAID_FIELD_ID,
  CLOSE_PAID_PLATFORM_FIELD_ID: process.env.CLOSE_PAID_PLATFORM_FIELD_ID,
  CLOSE_PAID_SOURCE_KEY_FIELD_ID: process.env.CLOSE_PAID_SOURCE_KEY_FIELD_ID,
  CLOSE_CAMPAIGN_ID_FIELD_ID: process.env.CLOSE_CAMPAIGN_ID_FIELD_ID,
  CLOSE_CAMPAIGN_NAME_FIELD_ID: process.env.CLOSE_CAMPAIGN_NAME_FIELD_ID,
  CLOSE_ADSET_ID_FIELD_ID: process.env.CLOSE_ADSET_ID_FIELD_ID,
  CLOSE_ADSET_NAME_FIELD_ID: process.env.CLOSE_ADSET_NAME_FIELD_ID,
  CLOSE_AD_GROUP_ID_FIELD_ID: process.env.CLOSE_AD_GROUP_ID_FIELD_ID,
  CLOSE_AD_GROUP_NAME_FIELD_ID: process.env.CLOSE_AD_GROUP_NAME_FIELD_ID,
  CLOSE_GROUP_ID_FIELD_ID: process.env.CLOSE_GROUP_ID_FIELD_ID,
  CLOSE_GROUP_NAME_FIELD_ID: process.env.CLOSE_GROUP_NAME_FIELD_ID,
  CLOSE_AD_ID_FIELD_ID: process.env.CLOSE_AD_ID_FIELD_ID,
  CLOSE_AD_NAME_FIELD_ID: process.env.CLOSE_AD_NAME_FIELD_ID,
  CLOSE_EXPERIMENT_KEY_FIELD_ID: process.env.CLOSE_EXPERIMENT_KEY_FIELD_ID,
  CLOSE_VARIANT_KEY_FIELD_ID: process.env.CLOSE_VARIANT_KEY_FIELD_ID,
  CLOSE_STATE_MARKET_FIELD_ID: process.env.CLOSE_STATE_MARKET_FIELD_ID,
  CLOSE_BUSINESS_STAGE_FIELD_ID: process.env.CLOSE_BUSINESS_STAGE_FIELD_ID,
  CLOSE_BUDGET_RANGE_FIELD_ID: process.env.CLOSE_BUDGET_RANGE_FIELD_ID,
  CLOSE_AVAILABLE_CAPITAL_FIELD_ID:
    process.env.CLOSE_AVAILABLE_CAPITAL_FIELD_ID,
  CLOSE_PURCHASE_TIMELINE_FIELD_ID:
    process.env.CLOSE_PURCHASE_TIMELINE_FIELD_ID,
  CLOSE_LOCATION_STATUS_FIELD_ID: process.env.CLOSE_LOCATION_STATUS_FIELD_ID,
  CLOSE_MACHINE_GOAL_FIELD_ID: process.env.CLOSE_MACHINE_GOAL_FIELD_ID,
  CLOSE_PRIMARY_GOAL_FIELD_ID: process.env.CLOSE_PRIMARY_GOAL_FIELD_ID,
  CLOSE_CONSENT_STATUS_FIELD_ID: process.env.CLOSE_CONSENT_STATUS_FIELD_ID,
  CLOSE_LATEST_COMPLETED_AT_FIELD_ID:
    process.env.CLOSE_LATEST_COMPLETED_AT_FIELD_ID,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_SEO_MODEL: process.env.OPENAI_SEO_MODEL,
  OPENAI_SEO_REASONING_EFFORT: process.env.OPENAI_SEO_REASONING_EFFORT,
});

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten());
  throw new Error("Invalid environment variables");
}

export const config = parsed.data;

export const publicConfig = {
  siteUrl: config.NEXT_PUBLIC_SITE_URL ?? "https://www.vendingpreneurs.com",
} as const;
