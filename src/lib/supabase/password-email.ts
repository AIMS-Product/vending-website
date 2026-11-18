import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendResend } from "@/lib/chatbot/emails";
import { buildPasswordResetRedirectUrl } from "@/lib/supabase/auth-redirects";

/**
 * Sends the password setup/reset email ourselves instead of through
 * Supabase's mailer. Supabase's link only honors our redirect when it is on
 * the project's redirect allowlist, otherwise it falls back to the Site URL
 * root, and its PKCE code only works in the browser that asked. Emma landed
 * on `/?code=` that way twice (2026-11-17/18). A `token_hash` link straight to
 * /auth/callback works in any browser, on whatever origin sent it.
 */
export async function sendPasswordSetupEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any typed service-role client
  admin: SupabaseClient<any, any, any>,
  email: string,
  origin: string,
  fetchImpl: typeof fetch = fetch,
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(error?.message ?? "Could not create a password link.");
  }

  const link = new URL(buildPasswordResetRedirectUrl(origin, email));
  link.searchParams.set("token_hash", tokenHash);
  link.searchParams.set("type", "recovery");

  const result = await sendResend(
    {
      to: [email],
      subject: "Set your Vendingpreneurs password",
      text: [
        "Use this link to set your password for the Vendingpreneurs site editor:",
        link.toString(),
        "The link works once and expires soon. If it has expired, request a new one from the login page.",
        "If you did not ask for this, you can ignore this email.",
      ].join("\n\n"),
    },
    fetchImpl,
  );
  if (!result.ok) throw new Error(result.error);
}
