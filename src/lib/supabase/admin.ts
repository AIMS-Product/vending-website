import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Service-role Supabase client. Bypasses RLS — only callable from
 * `server-only` modules. Use for: storage uploads from the admin UI,
 * seeding the `app_users` allowlist, and any operation that legitimately
 * needs to bypass row-level policies.
 *
 * Never expose this client (or anything that imports from it) to a Client
 * Component or Route Handler reachable from the browser without an auth
 * gate in front of it.
 */
let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;
  adminClient = createSupabaseClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  return adminClient;
}
