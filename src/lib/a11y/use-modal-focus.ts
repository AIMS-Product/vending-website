"use client";

import { useEffect, type RefObject } from "react";
import { FOCUSABLE_SELECTOR, trapTabKey } from "./focus-trap";

/**
 * Focus management for a custom modal dialog (WCAG 2.4.3): when `active`
 * turns true, remember the control that opened it and move focus inside;
 * keep Tab and Shift+Tab within the dialog; on close, give focus back.
 * Escape handling stays with the caller, which already owns "close".
 *
 * `initialFocus: "first"` focuses the first control (put the safest action,
 * such as Cancel, first); `"container"` focuses the dialog element itself,
 * which must carry `tabIndex={-1}`.
 */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  active = true,
  initialFocus: "first" | "container" = "first",
): void {
  useEffect(() => {
    const dialog = ref.current;
    if (!active || !dialog) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const first =
      initialFocus === "first"
        ? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        : null;
    (first ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => trapTabKey(event, dialog);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [ref, active, initialFocus]);
}
