import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing route. Supabase emails the user a URL of the form
 * `<site>/auth/callback?code=<one_time>`; we exchange the code for a
 * session, which writes the auth cookies via the SSR client's `setAll`
 * handler.
 *
 * On success we send the user to `/admin/news`. The proxy + `requireAdmin`
 * still run there — if the email is authenticated but not in `app_users`
 * they bounce back to the login page (with a query flag the form can
 * surface). On failure we land them on the login page with `?error=...`
 * so the form can render a useful message.
 *
 * `next` query param is honoured so a future redirect-to-original-URL
 * flow can pass it from the proxy.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin/news";

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth/callback exchange failed", error);
    return NextResponse.redirect(`${origin}/admin/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
