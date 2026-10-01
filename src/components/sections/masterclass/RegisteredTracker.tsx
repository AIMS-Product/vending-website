"use client";

import { useEffect } from "react";
import { trackMasterclassRegistered } from "@/lib/tracking/funnel-events";

/** Fires the registration conversion once per session on /masterclass-confirmed. */
export function RegisteredTracker() {
  useEffect(() => {
    trackMasterclassRegistered();
  }, []);
  return null;
}
