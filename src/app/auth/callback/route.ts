import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_FORGOT_PASSWORD_PATH,
  adminPathWithEmail,
  normalizeAdminEmailParam,
  normalizeRecoveryNextPath,
} from "@/lib/supabase/auth-redirects";
import { createClient } from "@/lib/supabase/server";

/**
 * Password setup/reset landing route. Supabase recovery emails send users here
 * with either a `token_hash` (email template link, works in any browser) or a
 * one-time PKCE `code` (only in the browser that asked for the reset). Either
 * becomes an SSR session, then the user lands on the first-party reset form.
 *
 * `token_hash` exists because invite/resend emails are sent by the service-role
 * client, whose implicit-flow links put the session in the URL fragment, which
 * a server route never sees (Emma's invite, 2026-11-17).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const isRecoveryTokenHash =
    Boolean(tokenHash) && searchParams.get("type") === "recovery";
  const email = normalizeAdminEmailParam(searchParams.get("email"));
  const recoveryNextPath = normalizeRecoveryNextPath(
    searchParams.get("next"),
    email,
  );

  if (!code && !isRecoveryTokenHash) {
    return NextResponse.redirect(
      `${origin}${adminPathWithEmail(
        `${ADMIN_FORGOT_PASSWORD_PATH}?error=missing_code`,
        email,
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = isRecoveryTokenHash
    ? await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash: tokenHash as string,
      })
    : await supabase.auth.exchangeCodeForSession(code as string);

  if (error) {
    console.error("auth/callback recovery exchange failed", error);
    return NextResponse.redirect(
      `${origin}${adminPathWithEmail(
        `${ADMIN_FORGOT_PASSWORD_PATH}?error=exchange_failed`,
        email,
      )}`,
    );
  }

  return NextResponse.redirect(`${origin}${recoveryNextPath}`);
}
