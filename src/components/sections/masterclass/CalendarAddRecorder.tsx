"use client";

import { useEffect } from "react";
import { recordCalendarAdd } from "@/app/masterclass-confirmed/actions";

/**
 * Names who added the room to which calendar: a click on a calendar button
 * (`data-track="calendar_added"`) tags the registrant's GHL contact. Rendered
 * only with a signed session; the link opens either way.
 */
export function CalendarAddRecorder() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(
        '[data-track="calendar_added"]',
      );
      if (!el) return;
      recordCalendarAdd(el.dataset.trackDetail).catch((error: unknown) =>
        console.warn("calendar add not recorded", {
          name: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    };
    // auxclick: a middle-click opens the link too.
    for (const type of ["click", "auxclick"] as const)
      document.addEventListener(type, onClick, { capture: true });
    return () => {
      for (const type of ["click", "auxclick"] as const)
        document.removeEventListener(type, onClick, { capture: true });
    };
  }, []);
  return null;
}
