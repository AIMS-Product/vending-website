import "server-only";
import { z } from "zod";

const optionalEnv = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalTrimmedEnv = (fallback: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).default(fallback),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RESEND_API_KEY: optionalEnv,
  LEAD_NOTIFICATION_TO: optionalEnv,
  LEAD_NOTIFICATION_FROM: optionalEnv,
  LEAD_NOTIFICATION_SUBJECT_PREFIX: optionalEnv,
  SLACK_WEBHOOK_URL: optionalEnv,
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
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;
