"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";

/**
 * Sign the current admin out. Clears Supabase session cookies through the SSR
 * client, then bounces back to the admin login page.
 */
export async function signOut() {
  const [, supabase] = await Promise.all([requireAuth(), createClient()]);
  await supabase.auth.signOut();
  redirect("/admin/login");
}
