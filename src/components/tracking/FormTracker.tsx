"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureEvent, SEND_NOW } from "@/lib/tracking/posthog";
import {
  abandonmentProperties,
  formIdentity,
  isFormResolved,
  markAbandonReported,
  markFieldCompleted,
  markStarted,
  markSubmitAttempted,
  markViewed,
  newProgress,
  resetResolvedForms,
  secondsOnForm,
  type FormProgress,
} from "@/lib/tracking/form-tracking";

const FORM_SELECTOR = "form[data-form-step]";
const IGNORED_FIELDS = new Set(["idempotency_key", "session_token"]);

/**
 * Mounted once in the root layout. Watches every `form[data-form-step]` on
 * the page through delegated listeners and reports the pre-submit funnel to
 * PostHog: `form_viewed` (30% in viewport), `form_started` (first field
 * focus), `form_field_completed` (per field, on change, names only, never
 * values), `form_submit_attempted`, and `form_abandoned` when the page is left
 * after a start with no successful submit. Result events come from the forms
 * themselves via `trackFormResult`.
 *
 * Re-runs per pathname so a client-side navigation away from a started form
 * counts as an abandonment too, not only a tab close.
 */
export function FormTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const progress = new Map<HTMLFormElement, FormProgress>();
    // The page the forms live on. A client-side navigation flushes
    // `form_abandoned` from the cleanup below, when window.location already
    // points at the next page; stamping the form's own URL keeps
    // `source_path` / `page_group` on the page that lost the visitor.
    const pageUrl = window.location.href;

    const viewport = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const form = entry.target as HTMLFormElement;
          const current = progress.get(form);
          if (!current || current.viewed) continue;
          progress.set(form, markViewed(current));
          captureEvent("form_viewed", current.identity);
          viewport.unobserve(form);
        }
      },
      { threshold: 0.3 },
    );

    const track = (form: HTMLFormElement) => {
      const existing = progress.get(form);
      if (existing) return existing;
      const identity = formIdentity({
        id: form.id,
        step: form.dataset.formStep,
      });
      if (!identity) return null;
      const created = newProgress(identity);
      progress.set(form, created);
      viewport.observe(form);
      return created;
    };

    const scan = () => {
      document.querySelectorAll<HTMLFormElement>(FORM_SELECTOR).forEach(track);
    };
    scan();
    const additions = new MutationObserver(scan);
    additions.observe(document.body, { childList: true, subtree: true });

    const start = (
      form: HTMLFormElement,
      current: FormProgress,
      field: string,
    ) => {
      if (current.startedAt !== null) return current;
      const started = markStarted(current, field, Date.now());
      progress.set(form, started);
      captureEvent("form_started", { ...started.identity, first_field: field });
      return started;
    };

    const onFocusIn = (event: FocusEvent) => {
      const form = formFrom(event.target);
      const field = fieldNameFrom(event.target);
      if (!form || !field) return;
      const current = track(form);
      if (current) start(form, current, field);
    };

    const onChange = (event: Event) => {
      const form = formFrom(event.target);
      const field = fieldNameFrom(event.target);
      if (!form || !field || !hasValue(event.target)) return;
      const tracked = track(form);
      if (!tracked) return;
      const current = start(form, tracked, field);
      if (current.completedFields.includes(field)) return;
      const next = markFieldCompleted(current, field);
      progress.set(form, next);
      captureEvent("form_field_completed", {
        ...next.identity,
        field,
        field_index: next.completedFields.length,
        fields_completed: next.completedFields.length,
        seconds_since_start: secondsOnForm(next, Date.now()),
      });
    };

    const onSubmit = (event: Event) => {
      const form = formFrom(event.target);
      if (!form) return;
      const current = track(form);
      if (!current) return;
      progress.set(form, markSubmitAttempted(current));
      captureEvent("form_submit_attempted", {
        ...current.identity,
        fields_completed: current.completedFields.length,
        seconds_on_form: secondsOnForm(current, Date.now()),
      });
    };

    const flushAbandoned = () => {
      const now = Date.now();
      for (const [form, current] of progress) {
        const properties = abandonmentProperties(
          current,
          now,
          isFormResolved(current.identity.form_id),
        );
        if (!properties) continue;
        progress.set(form, markAbandonReported(current));
        captureEvent(
          "form_abandoned",
          { ...properties, $current_url: pageUrl },
          SEND_NOW,
        );
      }
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pagehide", flushAbandoned);

    return () => {
      // Pathname changed: the old page's forms are gone, so anything started
      // and unresolved was abandoned by navigating away.
      flushAbandoned();
      resetResolvedForms();
      viewport.disconnect();
      additions.disconnect();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pagehide", flushAbandoned);
    };
  }, [pathname]);

  return null;
}

function formFrom(target: EventTarget | null): HTMLFormElement | null {
  const element = target instanceof Element ? target : null;
  return element?.closest<HTMLFormElement>(FORM_SELECTOR) ?? null;
}

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isField(target: EventTarget | null): target is Field {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

/** The field's name, never its value. Hidden and bookkeeping inputs are skipped. */
function fieldNameFrom(target: EventTarget | null): string | null {
  if (!isField(target)) return null;
  if (target instanceof HTMLInputElement && target.type === "hidden")
    return null;
  const name = target.name.trim();
  return name && !IGNORED_FIELDS.has(name) ? name : null;
}

function hasValue(target: EventTarget | null): boolean {
  if (!isField(target)) return false;
  if (
    target instanceof HTMLInputElement &&
    (target.type === "checkbox" || target.type === "radio")
  ) {
    return target.checked;
  }
  return target.value.trim() !== "";
}
