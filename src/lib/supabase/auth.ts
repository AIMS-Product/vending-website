import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "./server";
import { createAdminClient } from "./admin";
import { getDevAdminContext } from "./dev-auth";
import type { Database } from "@/types/database";

/**
 * `viewer` is read-only reporting access and nothing else. It exists so
 * people who need the numbers can have their own login instead of a shared
 * password: a shared password has no audit trail and survives offboarding.
 */
export type AdminRole = "viewer" | "admin" | "super_admin";

export type AdminContext = {
  user: { id: string; email: string };
  role: AdminRole;
};

type ResolveOptions = {
  serverClient?: SupabaseClient<Database>;
  adminClient?: SupabaseClient<Database>;
};

export class AdminAuthorizationError extends Error {
  constructor(message = "Super admin access is required.") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export function isAdminRole(value: string): value is AdminRole {
  return value === "viewer" || value === "admin" || value === "super_admin";
}

/**
 * The single place that answers "may this role change anything". Everything
 * that mutates content, reads lead PII, or reads chatbot transcripts checks
 * this, rather than each call site writing its own `role !== "viewer"` —
 * one scattered comparison written the wrong way round is a data leak.
 */
export function canEditAdmin(role: AdminRole): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Resolve the current viewer to an `app_users` row, or `null` when they
 * are not signed in or are signed in with a non-allowlisted email.
 *
 * Pure of redirect/throw side effects so tests can drive it directly with
 * mock clients. Production callers go through `requireAdmin()` (below).
 *
 * Auth source of truth is `auth.getUser()` — a network call to the GoTrue
 * server that validates the JWT. We never use `auth.getSession()` for
 * authorization: that returns whatever is in the cookie and a malicious
 * client can forge a cookie with a spoofed `sub` claim.
 *
 * The `app_users` lookup goes through the service-role admin client to
 * sidestep any RLS misconfiguration on `app_users` itself — if RLS were
 * accidentally loosened or revoked, the gate must still hold.
 */
export async function getAuthorizedAdmin(
  opts: ResolveOptions = {},
): Promise<AdminContext | null> {
  if (process.env.NODE_ENV === "development") {
    const devContext = getDevAdminContext();
    if (devContext) {
      return devContext;
    }
  }

  const supabase = opts.serverClient ?? (await createServerSupabase());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) return null;

  const admin = opts.adminClient ?? createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("app_users")
    .select("user_id, email, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (rowError || !row || !isAdminRole(row.role)) return null;

  return {
    user: { id: user.id, email: user.email },
    role: row.role,
  };
}

/**
 * Defence-in-depth gate for every `/admin/*` Server Component and Server
 * Action. The Next 16 proxy (`src/proxy.ts`) gates pages on navigation,
 * but proxy coverage can silently disappear if a Server Function moves to
 * a route the matcher excludes. RLS is the bottom layer; this helper is
 * the middle layer; the proxy is the top.
 *
 * Redirects to `/admin/login` rather than throwing — this is a UX gate,
 * not a programming error, and Next handles `redirect()` natively in both
 * Server Components and Server Actions.
 *
 * Viewers are turned away here. That is deliberate: `requireAdmin()` stays
 * the default gate on every existing page and every page written from now
 * on, so a surface nobody thought about is closed to viewers for free. Only
 * the four reporting pages opt in to `requireReadAccess()` below.
 */
export async function requireAdmin(
  opts: ResolveOptions = {},
): Promise<AdminContext> {
  const ctx = await requireReadAccess(opts);
  if (!canEditAdmin(ctx.role)) {
    // Not `/admin/login`: a viewer IS signed in, and bouncing them to a
    // login form they would immediately pass would look like a broken
    // session. `/admin` is the reporting home they are allowed to see.
    redirect("/admin");
  }
  return ctx;
}

/**
 * The read-only gate: signed in and on the `app_users` allowlist, any role.
 * Used only by the four pages a viewer may open (`/admin`,
 * `/admin/analytics`, `/admin/bookings`, `/admin/attribution`) and by sign
 * out — a viewer who cannot sign out is stuck in a session they can only
 * clear from browser settings.
 */
export async function requireReadAccess(
  opts: ResolveOptions = {},
): Promise<AdminContext> {
  const ctx = await getAuthorizedAdmin(opts);
  if (!ctx) redirect("/admin/login");
  return ctx;
}

/**
 * Deliberately does not chain through `requireAdmin()`. A viewer who POSTs
 * straight at a user-management Server Action must get this catchable error,
 * which the action turns into a message — a `redirect()` thrown inside an
 * action's try/catch would be swallowed as a generic failure and logged as
 * noise.
 */
export async function requireSuperAdmin(
  opts: ResolveOptions = {},
): Promise<AdminContext> {
  const ctx = await requireReadAccess(opts);
  if (ctx.role !== "super_admin") {
    throw new AdminAuthorizationError();
  }
  return ctx;
}
