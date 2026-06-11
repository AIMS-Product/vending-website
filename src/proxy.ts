import { NextResponse, type NextRequest } from "next/server";
import { resolveRedirectDestination } from "@/lib/redirects";
import { hasPublishedPostSlug } from "@/lib/services/news";
import {
  getBuilderRedirectBySourcePath,
  hasPublishedSeoPagePath,
} from "@/lib/services/seo-page-public";
import {
  isBuilderRoutePath,
  splitAssignableBuilderRoutePath,
} from "@/lib/page-builder/page-paths";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";
import { hasActiveSeoPagePreviewToken } from "@/lib/services/seo-pages";
import {
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_LOGIN_PATH,
  normalizeAdminNextPath,
  supabaseAuthErrorRedirectPath,
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

const REMOVED_PUBLIC_PATHS = new Set(["/test-leadscore-a"]);

// S6b-2: paths admitted by the shape matcher ("/:prefix([a-z0-9-]+)/:slug")
// that belong to other proxy flows. /admin, /auth, and /news two-segment
// paths must keep flowing to their existing branches below byte-identically.
const TWO_SEGMENT_PATH = /^\/[^/]+\/[^/]+$/;

function isCustomBuilderPathCandidate(path: string) {
  if (!TWO_SEGMENT_PATH.test(path)) return false;
  return (
    !path.startsWith("/admin/") &&
    !path.startsWith("/auth/") &&
    !path.startsWith("/news/")
  );
}

/**
 * Serves redirect rows for builder pages under admin-configured custom
 * prefixes as real HTTP 3xx responses, mirroring the default-prefix branch
 * above. Custom prefixes cannot appear in the static matcher, so a shape
 * matcher admits all two-segment kebab-case paths and this branch terminates
 * every one of them with a redirect or `NextResponse.next()` — nothing here
 * may ever fall through to the admin auth gate.
 *
 * Redirects MUST be emitted here (pre-routing) rather than in the page:
 * `redirect()`/`permanentRedirect()` inside a streaming render degrade to a
 * client-side meta tag after the 200 shell has flushed
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 * permanentRedirect.md — "When used in a streaming context, this will insert
 * a meta tag to emit the redirect on the client side."), which crawlers and
 * non-JS clients never follow.
 */
async function handleCustomBuilderPath(request: NextRequest, path: string) {
  // Shape + reservation gate: reserved segments (e.g. /authors, /images) and
  // non-kebab paths are not builder candidates — no DB lookups for them.
  const split = splitAssignableBuilderRoutePath(path);
  if (!split) return NextResponse.next();

  const configured = await listRoutePrefixes();
  const isConfigured = configured.some(
    (entry) => entry.prefix === split.routePrefix,
  );
  if (!isConfigured) return NextResponse.next();

  const redirect = await getBuilderRedirectBySourcePath(path);
  if (redirect) {
    return NextResponse.redirect(
      resolveRedirectDestination(request, redirect.destination_path),
      redirect.status_code,
    );
  }

  // Existence/404 handling stays with the route (same streamed-shell
  // behavior as the rest of the app); only redirects need real 3xx here.
  return NextResponse.next();
}

/**
 * Next 16 proxy (formerly `middleware.ts`). Two responsibilities:
 *
 *   1. Refresh the Supabase auth cookie on every navigation under the
 *      matcher, so Server Components see a valid session.
 *   2. Gate `/admin/*` routes — anyone who is not signed in OR not in
 *      `app_users` gets bounced to `/admin/login`.
 *
 * `/admin/login` and `/admin/forgot-password` bypass the gate (otherwise
 * anonymous users cannot start auth). `/auth/*` bypasses the gate so password
 * recovery/setup callbacks can exchange their code for a session without an
 * established user.
 *
 * Defence in depth: every `/admin/*` Server Component still calls
 * `requireAdmin()`, and the database still enforces RLS. Three layers,
 * any one of which would block an unauthorized read or write on its own.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/") {
    const authErrorRedirect = supabaseAuthErrorRedirectPath(
      request.nextUrl.searchParams,
    );
    if (authErrorRedirect) {
      return NextResponse.redirect(new URL(authErrorRedirect, request.url));
    }

    return NextResponse.next();
  }

  if (REMOVED_PUBLIC_PATHS.has(path)) {
    return notFoundResponse();
  }

  if (path.startsWith("/blog/author/")) {
    return notFoundResponse();
  }

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

  if (isBuilderRoutePath(path)) {
    const redirect = await getBuilderRedirectBySourcePath(path);
    if (redirect) {
      return NextResponse.redirect(
        resolveRedirectDestination(request, redirect.destination_path),
        redirect.status_code,
      );
    }

    let routePath: string;
    try {
      routePath = decodeURIComponent(path);
    } catch {
      return notFoundResponse();
    }
    const exists = await hasPublishedSeoPagePath(routePath);
    if (!exists) {
      // Legacy /blog/{slug} links permanently redirect to the matching
      // published news article. A published builder page at the same path
      // wins (handled above); only otherwise do we fall back to news.
      if (routePath.startsWith("/blog/")) {
        const slug = routePath.replace(/^\/blog\//, "");
        if (await hasPublishedPostSlug(slug)) {
          return NextResponse.redirect(
            new URL(`/news/${slug}`, request.url),
            308,
          );
        }
      }
      return notFoundResponse();
    }

    return NextResponse.next();
  }

  // Custom builder prefixes (e.g. /services/{slug}) — terminal branch; see
  // handleCustomBuilderPath. Default prefixes were handled above.
  if (isCustomBuilderPathCandidate(path)) {
    return handleCustomBuilderPath(request, path);
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

  // The login and reset-request pages must remain reachable to anonymous users.
  if (path === ADMIN_LOGIN_PATH || path === ADMIN_FORGOT_PASSWORD_PATH) {
    return response;
  }

  // Auth callback / sign-out / etc. — proxy just refreshed the cookie;
  // the route handler itself is responsible for whatever it does next.
  if (path.startsWith("/auth")) return response;

  // From here, we are inside /admin/* (other than /admin/login).
  if (!user) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  // Enforce the same predicate as the inner requireAdmin layer: row
  // existence alone would silently stop filtering if a non-admin role is
  // ever added to app_users.
  const { data: row } = await supabase
    .from("app_users")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdminRole = row?.role === "admin" || row?.role === "super_admin";
  if (!isAdminRole) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/",
      has: [{ type: "query", key: "error" }],
    },
    "/admin/:path*",
    "/auth/:path*",
    "/resources/:path*",
    "/blog/:path*",
    "/landing/:path*",
    "/videos/:path*",
    "/solutions/:path*",
    "/news/:path*",
    "/test-leadscore-a",
    // S6b-2: admin-configured custom builder prefixes can't be listed
    // statically, so admit every two-segment lowercase-kebab path (the only
    // shape a builder route_path can take). `_next`, dotted hosts/files, and
    // uppercase paths don't match the [a-z0-9-] shape; everything admitted
    // here is terminated by handleCustomBuilderPath or an earlier branch.
    "/:prefix([a-z0-9-]+)/:slug([^/]+)",
  ],
};
