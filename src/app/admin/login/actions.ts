"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const emailSchema = z.email();

/**
 * Derive the origin from the incoming Server Action request rather than a
 * hardcoded env var. This makes the magic link land back on whichever
 * deployment the user was on (localhost in dev, the preview URL on
 * branch deploys, the canonical domain in production) without us having
 * to keep `NEXT_PUBLIC_SITE_URL` in sync per environment.
 *
 * Each origin still needs to be allowlisted in Supabase Dashboard →
 * Authentication → URL Configuration → Redirect URLs.
 */
async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("No host header on incoming request");
  return `${proto}://${host}`;
}

/**
 * Server Action behind the magic-link form. Validates email server-side
 * (never trust client-supplied input), then asks Supabase to mail an OTP
 * link. Returns a discriminated state for `useActionState` to render
 * either a confirmation or an error message.
 *
 * `shouldCreateUser: true` lets a non-allowlisted email finish OAuth, but
 * the `app_users` gate (proxy + `requireAdmin()`) keeps them out of every
 * admin surface. The `on_auth_user_created` trigger only inserts an
 * `app_users` row when the email matches `app_user_emails`, so a stray
 * sign-up never grants access — it just leaves an unused `auth.users` row.
 *
 * Errors are surfaced as a generic message; the underlying Supabase error
 * is logged server-side for diagnosis but never sent to the browser.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const origin = await originFromHeaders();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("requestMagicLink failed", { email: parsed.data, error });
    return {
      status: "error",
      message: "Couldn't send the link. Try again in a moment.",
    };
  }

  return { status: "sent", email: parsed.data };
}
