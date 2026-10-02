"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  buildPasswordResetRedirectUrl,
  resolveAuthEmailOrigin,
} from "@/lib/supabase/auth-redirects";
import { publicConfig } from "@/lib/config";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PasswordResetState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const emailSchema = z.email("Enter a valid email address.");

export async function requestPasswordReset(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = emailSchema.safeParse(email);

  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  // Throttled before the allowlist lookup and for every address alike, so the
  // refusal says nothing about whether the email has an account.
  const allowed =
    (await checkPublicRateLimit("admin_password_reset_ip", {
      ip: requestIp(await headers()),
    })) &&
    (await checkPublicRateLimit("admin_password_reset_email", {
      ip: null,
      email: parsed.data,
    }));
  if (!allowed) {
    return { status: "error", message: TOO_MANY_REQUESTS_MESSAGE };
  }

  const hasAccess = await hasAdminEmailAccess(parsed.data);
  if (hasAccess) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: buildPasswordResetRedirectUrl(
        await originFromHeaders(),
        parsed.data,
      ),
    });

    if (error) {
      // No address in the log: it is PII and the error carries the cause.
      console.error("requestPasswordReset failed", { error: error.message });
    }
  }

  return { status: "sent", email: parsed.data };
}

async function hasAdminEmailAccess(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_user_emails")
    .select("email, role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("admin password reset lookup failed", {
      error: error.message,
    });
    return false;
  }

  return Boolean(data);
}

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  return resolveAuthEmailOrigin({
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
    siteUrl: publicConfig.siteUrl,
    deploymentHost: process.env.VERCEL_URL,
    isProduction: process.env.NODE_ENV === "production",
  });
}
