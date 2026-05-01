import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * Refresh the Supabase session for an incoming request inside the Next 16
 * proxy (the renamed `middleware.ts` convention). Returns:
 *
 *   - `response`  the NextResponse to forward downstream, with refreshed
 *                 auth cookies attached
 *   - `user`      the verified user via `auth.getUser()` (network call —
 *                 NOT `getSession()`, which only inspects the cookie and
 *                 can be spoofed)
 *   - `supabase`  the client itself, in case the caller needs a follow-up
 *                 RLS-bound query (e.g. checking `app_users` membership)
 *
 * The two-step cookie dance is required by `@supabase/ssr`: we mirror
 * refreshed cookies into both `request.cookies` (so the rest of the proxy
 * sees them) and `response.cookies` (so the browser persists them).
 * Skipping it causes random logouts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
