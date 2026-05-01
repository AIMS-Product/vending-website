import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Uses the anon key — RLS policies are the security boundary. For privileged
 * writes (admin mutations, storage admin), use `createAdminClient()` from
 * `./admin.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll throws when called from a Server Component because
            // cookies() is read-only there. Middleware refreshes the
            // session on the next navigation, so this is safe to ignore.
          }
        },
      },
    },
  );
}
