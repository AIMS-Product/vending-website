import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirectDestination } from "@/lib/redirects";
import {
  getBuilderRedirectBySourcePath,
  hasPublishedSeoPageSlug,
} from "@/lib/services/seo-page-public";
import { updateSession } from "@/lib/supabase/middleware";

const LOGIN_PATH = "/admin/login";

/**
 * Next 16 proxy (formerly `middleware.ts`). Two responsibilities:
 *
 *   1. Refresh the Supabase auth cookie on every navigation under the
 *      matcher, so Server Components see a valid session.
 *   2. Gate `/admin/*` routes — anyone who is not signed in OR not in
 *      `app_users` gets bounced to `/admin/login`.
 *
 * `/admin/login` itself bypasses the gate (otherwise infinite redirect
 * loop). `/auth/*` bypasses the gate so the magic-link callback can
 * exchange its code for a session without an established user.
 *
 * Defence in depth: every `/admin/*` Server Component still calls
 * `requireAdmin()`, and the database still enforces RLS. Three layers,
 * any one of which would block an unauthorized read or write on its own.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/resources/")) {
    if (path.startsWith("/resources/preview/")) {
      return NextResponse.next();
    }

    const redirect = await getBuilderRedirectBySourcePath(path);
    if (redirect) {
      return NextResponse.redirect(
        resolveRedirectDestination(request, redirect.destination_path),
        redirect.status_code,
      );
    }

    let slug: string;
    try {
      slug = decodeURIComponent(path.replace(/^\/resources\//, ""));
    } catch {
      return new Response("Not found", { status: 404 });
    }
    const exists = await hasPublishedSeoPageSlug(slug);
    if (!exists) {
      return new Response("Not found", { status: 404 });
    }

    return NextResponse.next();
  }

  const { response, user, supabase } = await updateSession(request);

  // The login page must remain reachable to anonymous users.
  if (path === LOGIN_PATH) return response;

  // Auth callback / sign-out / etc. — proxy just refreshed the cookie;
  // the route handler itself is responsible for whatever it does next.
  if (path.startsWith("/auth")) return response;

  // From here, we are inside /admin/* (other than /admin/login).
  if (!user) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const { data: row } = await supabase
    .from("app_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*", "/resources/:path*"],
};
