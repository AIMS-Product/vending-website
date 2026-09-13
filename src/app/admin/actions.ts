"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireReadAccess as requireAuth } from "@/lib/supabase/auth";

/**
 * Sign the current user out. Clears Supabase session cookies through the SSR
 * client, then bounces back to the admin login page.
 *
 * Gated on read access rather than edit access: sign out is rendered in the
 * shell on every page, so gating it on requireAdmin would redirect a viewer
 * to /admin instead of ending their session, leaving them no way out short
 * of clearing cookies by hand.
 */
export async function signOut() {
  const [, supabase] = await Promise.all([requireAuth(), createClient()]);
  await supabase.auth.signOut();
  redirect("/admin/login");
}
