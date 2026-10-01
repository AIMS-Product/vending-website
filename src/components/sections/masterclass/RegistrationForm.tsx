"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  registerForMasterclass,
  type RegistrationState,
} from "@/app/masterclass/actions";
import { EventDateLine } from "@/components/sections/masterclass/EventDateLine";
import {
  CompactCountdown,
  LocalTimeLine,
} from "@/components/sections/masterclass/EventTiming";
import { liveErrors } from "@/components/sections/masterclass/field-errors";
import { buttonClass } from "@/components/ui/Button";
import { FieldLabel, fieldClass, fieldErrorClass } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import {
  MASTERCLASS_FORM_ID,
  registrationFailure,
} from "@/lib/tracking/funnel-events";
import { setFormInFlight, trackFormResult } from "@/lib/tracking/form-tracking";
import {
  HONEYPOT_FIELD,
  SMS_CONSENT_TEXT,
  masterclassHero,
} from "@/lib/content/masterclass";

type Props = {
  /** UTMs from the ad click, carried into the submission. */
  attribution: Record<string, string>;
  eventLabel: string | null;
  /** ISO start; adds the weekday to the date line. */
  eventStartsAt?: string | null;
  /** Server render time (ms), so the date line hydrates in the same phase. */
  renderedAt: number;
};

const NO_EDITS: ReadonlySet<string> = new Set();

export function RegistrationForm({
  attribution,
  eventLabel,
  eventStartsAt,
  renderedAt,
}: Props) {
  const [state, action, pending] = useActionState<RegistrationState, FormData>(
    registerForMasterclass,
    {},
  );
  // Fields edited since this result came back; a new result starts clean.
  const [edits, setEdits] = useState({ result: state, fields: NO_EDITS });
  const edited = edits.result === state ? edits.fields : NO_EDITS;
  const errors = liveErrors(state.errors ?? {}, edited);
  const values = state.values;
  const markEdited = (event: React.FormEvent<HTMLFormElement>) => {
    const name = (event.target as HTMLInputElement).name;
    if (!name || !state.errors?.[name as keyof typeof errors]) return;
    if (edited.has(name)) return;
    setEdits({ result: state, fields: new Set([...edited, name]) });
  };
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submit, move focus to the first field that needs fixing so
  // keyboard and screen-reader users land on the problem, not on <body>.
  // A form-level error (no field to fix) takes focus on its own message.
  useEffect(() => {
    if (!state.errors) return;
    const form = formRef.current;
    const field = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (field) field.focus();
    else if (state.errors.form)
      form?.querySelector<HTMLElement>("#mc-form-error")?.focus();
  }, [state.errors]);

  // Success redirects to /masterclass-confirmed, which unmounts this form and
  // flushes abandonment; an in-flight submit must not read as abandoned.
  useEffect(() => {
    if (pending) setFormInFlight(MASTERCLASS_FORM_ID, true);
  }, [pending]);

  // Reports why a submit failed (field names and a reason, never values). The
  // success path redirects, so its event fires on /masterclass-confirmed.
  useEffect(() => {
    if (!state.errors) return;
    const { reason, errorKeys } = registrationFailure(state.errors);
    setFormInFlight(MASTERCLASS_FORM_ID, false);
    trackFormResult({
      formId: MASTERCLASS_FORM_ID,
      ok: false,
      errorKeys,
      properties: { reason },
    });
  }, [state.errors]);

  return (
    <form
      ref={formRef}
      id={MASTERCLASS_FORM_ID}
      data-form-step="1"
      action={action}
      onChange={markEdited}
      noValidate
      className="rounded-card border-ink shadow-card border-2 bg-white p-4 sm:p-7"
    >
      {/* Phones: dropped so the button fits the first screen; the phone
          hint below still names Zoom. */}
      <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase max-lg:hidden">
        {masterclassHero.formEyebrow}
      </p>
      <p className="v2-display text-ink text-[1.75rem] leading-none uppercase lg:mt-2 lg:text-[2rem]">
        {masterclassHero.formHeading}
      </p>
      {eventLabel ? (
        <p className="mt-1 text-[15px] font-semibold text-slate-600">
          <EventDateLine
            label={eventLabel}
            startsAt={eventStartsAt}
            renderedAt={renderedAt}
          />
        </p>
      ) : null}
      {eventStartsAt ? (
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-600">
          <CompactCountdown startsAt={eventStartsAt} />
          <LocalTimeLine startsAt={eventStartsAt} />
        </div>
      ) : null}

      <input
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="new-password"
        data-1p-ignore=""
        data-lpignore="true"
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      {Object.entries(attribution).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <div className="mt-3 grid grid-cols-1 items-start gap-2.5 min-[360px]:grid-cols-2 lg:mt-4 lg:gap-3">
        <Field
          name="firstName"
          label="First name"
          required
          autoComplete="given-name"
          maxLength={40}
          defaultValue={values?.firstName}
          error={errors.firstName}
        />
        <Field
          name="lastName"
          label="Last name"
          autoComplete="family-name"
          maxLength={40}
          defaultValue={values?.lastName}
          error={errors.lastName}
        />
      </div>
      <div className="mt-2.5 grid gap-2.5 lg:mt-3 lg:gap-3">
        <Field
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          defaultValue={values?.email}
          error={errors.email}
        />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          required
          autoComplete="tel"
          defaultValue={values?.phone}
          error={errors.phone}
          hint={masterclassHero.phoneHint}
        />
      </div>

      <label
        htmlFor="mc-smsConsent"
        className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-slate-600 lg:mt-4 lg:py-1 lg:leading-relaxed"
      >
        <input
          id="mc-smsConsent"
          type="checkbox"
          name="smsConsent"
          required
          defaultChecked={values?.smsConsent}
          aria-invalid={errors.smsConsent ? true : undefined}
          aria-describedby={errors.smsConsent ? "smsConsent-error" : undefined}
          className="size-5 shrink-0 cursor-pointer accent-[#1f72a5] aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-offset-2 aria-[invalid=true]:outline-red-600 aria-[invalid=true]:focus-visible:outline-red-600!"
        />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>
      {errors.smsConsent ? (
        <p
          id="smsConsent-error"
          role="alert"
          className="mt-1 text-xs font-semibold text-red-600"
        >
          {errors.smsConsent}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass({
          size: "lg",
          className: "mt-4 w-full disabled:opacity-60 lg:mt-5",
        })}
      >
        {pending ? "Saving your seat…" : "Save my free seat"}
      </button>

      {errors.form ? (
        <p
          id="mc-form-error"
          role="alert"
          tabIndex={-1}
          className="mt-3 rounded-sm text-center text-sm font-semibold text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          {errors.form}
        </p>
      ) : null}
      {state.notice ? (
        <p
          role="status"
          className="text-ink rounded-control border-ink bg-tint mt-3 border-2 px-4 py-3 text-center text-sm font-semibold"
        >
          {state.notice}
        </p>
      ) : null}

      <p className="mt-2 text-center text-xs text-slate-500">
        Free. Takes 20 seconds.{" "}
        <span className="whitespace-nowrap">
          {/* New tab: coming back here must not wipe the form. */}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center px-1 underline underline-offset-2"
          >
            Privacy
            <span className="sr-only"> (opens in new tab)</span>
          </Link>{" "}
          · {/* New tab: coming back here must not wipe the form. */}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center px-1 underline underline-offset-2"
          >
            Terms
            <span className="sr-only"> (opens in new tab)</span>
          </Link>
        </span>
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  hint,
  required = false,
  ...input
}: {
  name: string;
  label: string;
  error?: string;
  /** Why we ask; shown under the field, read with it. */
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  const id = `mc-${name}`;
  const describedBy =
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div>
      <FieldLabel
        htmlFor={id}
        required={required}
        className="mb-1 block lg:mb-1.5"
      >
        {label}
      </FieldLabel>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          fieldClass,
          error && fieldErrorClass,
          // Focused after a failed submit: stay red, not the blue focus ring.
          "aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-200 aria-[invalid=true]:focus-visible:outline-red-600!",
        )}
        {...input}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs font-semibold text-red-600"
        >
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
