"use client";

import { useEffect } from "react";
import { supabaseAuthErrorRedirectPathFromUrlParts } from "@/lib/supabase/auth-redirects";

export function SupabaseAuthErrorRedirect() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;

    const redirectPath = supabaseAuthErrorRedirectPathFromUrlParts(
      window.location.search,
      window.location.hash,
    );
    if (redirectPath) {
      window.location.replace(redirectPath);
    }
  }, []);

  return null;
}
