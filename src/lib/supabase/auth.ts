import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "./server";
import { createAdminClient } from "./admin";
import { getDevAdminContext } from "./dev-auth";
import type { Database } from "@/types/database";

export type AdminRole = "admin" | "editor";

export type AdminContext = {
  user: { id: string; email: string };
  role: AdminRole;
};

type ResolveOptions = {
  serverClient?: SupabaseClient<Database>;
  adminClient?: SupabaseClient<Database>;
};

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

  if (rowError || !row) return null;

  return {
    user: { id: user.id, email: user.email },
    role: row.role as AdminRole,
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
 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAuthorizedAdmin();
  if (!ctx) redirect("/admin/login");
  return ctx;
}
