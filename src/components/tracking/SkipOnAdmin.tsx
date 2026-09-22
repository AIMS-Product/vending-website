"use client";

import { usePathname } from "next/navigation";
import { shouldSkipAttributionTracking } from "@/components/attribution/AttributionSessionTracker";

/**
 * Renders its children everywhere except /admin. The marketing tags have no
 * business on internal dashboards: nine third-party scripts made every admin
 * page heavier and counted staff as site visitors (Adam, 2026-09-22).
 */
export function SkipOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return shouldSkipAttributionTracking(pathname) ? null : children;
}
