"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { z } from "zod";
import { buildPasswordResetRedirectUrl } from "@/lib/supabase/auth-redirects";
import { createAdminClient } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

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

  const hasAccess = await hasAdminEmailAccess(parsed.data);
  if (hasAccess) {
    const supabase = createPasswordEmailClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: buildPasswordResetRedirectUrl(await originFromHeaders()),
    });

    if (error) {
      console.error("requestPasswordReset failed", {
        email: parsed.data,
        error,
      });
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
    console.error("admin password reset lookup failed", { email, error });
    return false;
  }

  return Boolean(data);
}

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("No host header on incoming request");
  return `${proto}://${host}`;
}

function createPasswordEmailClient() {
  return createSupabaseClient<Database>(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
