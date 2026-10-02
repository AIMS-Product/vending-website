/**
 * Keyboard focus containment for non-native dialogs. `focusTrapTarget` is the
 * pure decision (testable without a DOM); `trapTabKey` applies it.
 */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Which element Tab / Shift+Tab should be sent to so focus stays inside the
 * container, or null when the browser's default move already stays inside.
 * `container` itself counts as "before the first control" (a dialog is
 * focused programmatically on open).
 */
export function focusTrapTarget<T>(
  focusables: readonly T[],
  active: unknown,
  container: unknown,
  shiftKey: boolean,
): T | null {
  if (focusables.length === 0) return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (shiftKey && (active === first || active === container)) return last;
  if (!shiftKey && active === last) return first;
  return null;
}

export function trapTabKey(
  event: KeyboardEvent,
  container: HTMLElement | null,
): void {
  if (!container || event.key !== "Tab") return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  const target = focusTrapTarget(
    focusables,
    document.activeElement,
    container,
    event.shiftKey,
  );
  if (target) {
    event.preventDefault();
    target.focus();
  }
}
