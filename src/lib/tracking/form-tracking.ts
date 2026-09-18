import { captureEvent, SEND_NOW } from "@/lib/tracking/posthog";

/**
 * Pre-submit form behaviour for PostHog: the one stretch of the funnel no
 * server table sees, because nothing is written until stage 1 submits.
 *
 * Pure state lives here so the event payloads are unit-testable; the DOM
 * listeners live in components/tracking/FormTracker.tsx. Every lead form on
 * the site renders `<form id="…-step-N" data-form-step="N">`, which is all the
 * tracker needs, so a new form is tracked without touching this file.
 */
export type FormIdentity = {
  form_id: string;
  form_name: string;
  form_step: number;
};

export type FormProgress = {
  identity: FormIdentity;
  viewed: boolean;
  startedAt: number | null;
  firstField: string | null;
  lastField: string | null;
  completedFields: readonly string[];
  submitAttempted: boolean;
  abandonReported: boolean;
};

const STEP_SUFFIX = /-step-(\d+)$/;

export function formIdentity(input: {
  id: string;
  step?: string | null;
}): FormIdentity | null {
  const id = input.id.trim();
  if (!id) return null;
  const suffix = STEP_SUFFIX.exec(id);
  const step = Number(input.step ?? suffix?.[1]);
  if (!Number.isInteger(step) || step < 1) return null;
  return {
    form_id: id,
    form_name: suffix ? id.slice(0, suffix.index) : id,
    form_step: step,
  };
}

export function newProgress(identity: FormIdentity): FormProgress {
  return {
    identity,
    viewed: false,
    startedAt: null,
    firstField: null,
    lastField: null,
    completedFields: [],
    submitAttempted: false,
    abandonReported: false,
  };
}

export function markViewed(progress: FormProgress): FormProgress {
  return progress.viewed ? progress : { ...progress, viewed: true };
}

export function markStarted(
  progress: FormProgress,
  field: string,
  now: number,
): FormProgress {
  if (progress.startedAt !== null) return progress;
  return { ...progress, startedAt: now, firstField: field, lastField: field };
}

export function markFieldCompleted(
  progress: FormProgress,
  field: string,
): FormProgress {
  if (progress.completedFields.includes(field)) return progress;
  return {
    ...progress,
    lastField: field,
    completedFields: [...progress.completedFields, field],
  };
}

export function markSubmitAttempted(progress: FormProgress): FormProgress {
  return { ...progress, submitAttempted: true };
}

export function markAbandonReported(progress: FormProgress): FormProgress {
  return { ...progress, abandonReported: true };
}

export function secondsOnForm(progress: FormProgress, now: number) {
  return progress.startedAt === null
    ? 0
    : Math.max(0, Math.round((now - progress.startedAt) / 1000));
}

/**
 * The `form_abandoned` payload, or null when there is nothing to report: the
 * visitor never started, the form was submitted, or it was already reported.
 */
export function abandonmentProperties(
  progress: FormProgress,
  now: number,
  resolved: boolean,
) {
  if (progress.startedAt === null || resolved || progress.abandonReported) {
    return null;
  }
  return {
    ...progress.identity,
    first_field: progress.firstField ?? "",
    last_field: progress.lastField ?? "",
    fields_completed: progress.completedFields.length,
    submit_attempted: progress.submitAttempted,
    seconds_on_form: secondsOnForm(progress, now),
  };
}

// Forms whose submit succeeded on the current page. Result events come from
// the form components (they own the server-action state); the DOM tracker
// consults this so a successful submit never also counts as an abandonment.
const resolvedForms = new Set<string>();

export function isFormResolved(formId: string) {
  return resolvedForms.has(formId);
}

export function resetResolvedForms() {
  resolvedForms.clear();
}

export type FormResult = {
  formId: string;
  ok: boolean;
  errorKeys?: readonly string[];
  properties?: Record<string, string | number | boolean | undefined>;
};

/**
 * `form_submitted` / `form_submit_failed`, called from the form's action-state
 * effect next to the GTM push. A failure leaves the form unresolved on purpose:
 * failing and then leaving is an abandonment worth seeing.
 */
export function trackFormResult(result: FormResult) {
  const identity = formIdentity({ id: result.formId });
  if (!identity) return;
  if (result.ok) resolvedForms.add(result.formId);
  captureEvent(
    result.ok ? "form_submitted" : "form_submit_failed",
    {
      ...identity,
      ...compactProperties(result.properties),
      ...(result.errorKeys ? { error_keys: [...result.errorKeys] } : {}),
    },
    result.ok ? SEND_NOW : undefined,
  );
}

function compactProperties(
  properties: FormResult["properties"],
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(properties ?? {}).filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined && entry[1] !== "",
    ),
  );
}
