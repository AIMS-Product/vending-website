import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirectDestination } from "@/lib/redirects";
import { hasPublishedPostSlug } from "@/lib/services/news";
import {
  getBuilderRedirectBySourcePath,
  hasPublishedSeoPageSlug,
} from "@/lib/services/seo-page-public";
import { hasActiveSeoPagePreviewToken } from "@/lib/services/seo-pages";
import {
  ADMIN_LOGIN_PATH,
  normalizeAdminNextPath,
} from "@/lib/supabase/auth-redirects";
import { isDevAdminAuthBypassEnabled } from "@/lib/supabase/dev-auth";
import { updateSession } from "@/lib/supabase/middleware";

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Not found | Vendingpreneurs</title>
  </head>
  <body>
    <main>
      <h1>Not found</h1>
      <p>The requested page could not be found.</p>
    </main>
  </body>
</html>`;

function notFoundResponse() {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

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
      let token: string;
      try {
        token = decodeURIComponent(path.replace(/^\/resources\/preview\//, ""));
      } catch {
        return notFoundResponse();
      }
      const exists = await hasActiveSeoPagePreviewToken(token);
      if (!exists) {
        return notFoundResponse();
      }
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
      return notFoundResponse();
    }
    const exists = await hasPublishedSeoPageSlug(slug);
    if (!exists) {
      return notFoundResponse();
    }

    return NextResponse.next();
  }

  // Public news index and RSS feed are always reachable by anonymous
  // visitors. The matcher (`/news/:path*`) also catches these, so they must
  // be allowed explicitly — otherwise they fall through to the `/admin/*`
  // auth gate below and get bounced to `/admin/login`.
  if (path === "/news" || path === "/news/feed.xml") {
    return NextResponse.next();
  }

  // Individual article pages must resolve to a published slug, else 404.
  if (path.startsWith("/news/")) {
    let slug: string;
    try {
      slug = decodeURIComponent(path.replace(/^\/news\//, ""));
    } catch {
      return notFoundResponse();
    }
    const exists = await hasPublishedPostSlug(slug);
    if (!exists) {
      return notFoundResponse();
    }

    return NextResponse.next();
  }

  if (
    path.startsWith("/admin") &&
    process.env.NODE_ENV === "development" &&
    isDevAdminAuthBypassEnabled()
  ) {
    if (path === ADMIN_LOGIN_PATH) {
      const destination = normalizeAdminNextPath(
        request.nextUrl.searchParams.get("next"),
      );
      const resolved = new URL(destination, request.url);
      if (resolved.origin !== request.nextUrl.origin) {
        return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
      }
      if (!destination || resolved.pathname === ADMIN_LOGIN_PATH) {
        return NextResponse.next();
      }
      return NextResponse.redirect(resolved);
    }

    return NextResponse.next();
  }

  const { response, user, supabase } = await updateSession(request);

  // The login page must remain reachable to anonymous users.
  if (path === ADMIN_LOGIN_PATH) return response;

  // Auth callback / sign-out / etc. — proxy just refreshed the cookie;
  // the route handler itself is responsible for whatever it does next.
  if (path.startsWith("/auth")) return response;

  // From here, we are inside /admin/* (other than /admin/login).
  if (!user) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  const { data: row } = await supabase
    .from("app_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/auth/:path*",
    "/resources/:path*",
    "/news/:path*",
  ],
};
