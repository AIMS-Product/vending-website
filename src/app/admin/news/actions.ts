"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign the current admin out. Clears the Supabase session cookies via the
 * SSR client's `setAll` handler, then bounces back to the login page.
 *
 * `redirect()` throws — Next 16 unwinds the Server Action and ships a 303
 * to the client without rendering anything else.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
