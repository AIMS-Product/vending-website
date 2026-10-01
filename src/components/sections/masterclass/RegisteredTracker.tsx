"use client";

import { useEffect } from "react";
import { trackMasterclassRegistered } from "@/lib/tracking/funnel-events";

/**
 * Fires the registration conversion once per session on /masterclass-confirmed,
 * only after a real registration (the server's registered cookie): caught bots
 * and direct visits to the URL never count.
 */
export function RegisteredTracker({
  justRegistered,
}: {
  justRegistered: boolean;
}) {
  useEffect(() => {
    if (justRegistered) trackMasterclassRegistered();
  }, [justRegistered]);
  return null;
}
