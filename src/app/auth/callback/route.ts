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
 * with a one-time `code`; this exchanges it for an SSR session and then sends
 * the user to the first-party reset form.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const email = normalizeAdminEmailParam(searchParams.get("email"));
  const recoveryNextPath = normalizeRecoveryNextPath(
    searchParams.get("next"),
    email,
  );

  if (!code) {
    return NextResponse.redirect(
      `${origin}${adminPathWithEmail(
        `${ADMIN_FORGOT_PASSWORD_PATH}?error=missing_code`,
        email,
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

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
