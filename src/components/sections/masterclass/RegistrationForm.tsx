"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import {
  registerForMasterclass,
  type RegistrationState,
} from "@/app/masterclass/actions";
import { buttonClass } from "@/components/ui/Button";
import { FieldLabel, fieldClass, fieldErrorClass } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import {
  HONEYPOT_FIELD,
  SMS_CONSENT_TEXT,
  masterclassHero,
} from "@/lib/content/masterclass";

type Props = {
  /** UTMs from the ad click, carried into the submission. */
  attribution: Record<string, string>;
  eventLabel: string | null;
};

export function RegistrationForm({ attribution, eventLabel }: Props) {
  const [state, action, pending] = useActionState<RegistrationState, FormData>(
    registerForMasterclass,
    {},
  );
  const errors = state.errors ?? {};
  const values = state.values;
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submit, move focus to the first field that needs fixing so
  // keyboard and screen-reader users land on the problem, not on <body>.
  useEffect(() => {
    if (!state.errors) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [state.errors]);

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="rounded-card border-ink shadow-card border-2 bg-white p-6 sm:p-7"
    >
      <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
        {masterclassHero.formEyebrow}
      </p>
      <p className="v2-display text-ink mt-2 text-[2rem] leading-none uppercase">
        {masterclassHero.formHeading}
      </p>
      {eventLabel ? (
        <p className="mt-1 text-[15px] font-semibold text-slate-600">
          {eventLabel}
        </p>
      ) : null}

      <input
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      {Object.entries(attribution).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <div className="mt-5 grid grid-cols-2 gap-3">
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
      <div className="mt-3 grid gap-3">
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
        />
      </div>

      <label
        htmlFor="mc-smsConsent"
        className="mt-4 flex cursor-pointer items-start gap-3 py-1 text-xs leading-relaxed text-slate-600"
      >
        <input
          id="mc-smsConsent"
          type="checkbox"
          name="smsConsent"
          required
          defaultChecked={values?.smsConsent}
          aria-invalid={errors.smsConsent ? true : undefined}
          aria-describedby={errors.smsConsent ? "smsConsent-error" : undefined}
          className="size-5 shrink-0 cursor-pointer accent-[#1f72a5]"
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
          className: "mt-5 w-full disabled:opacity-60",
        })}
      >
        {pending ? "Saving your seat…" : "Save my seat"}
      </button>

      {errors.form ? (
        <p
          role="alert"
          className="mt-3 text-center text-sm font-semibold text-red-600"
        >
          {errors.form}
        </p>
      ) : null}

      <p className="mt-2 text-center text-xs text-slate-500">
        Free. Takes 20 seconds.{" "}
        <Link
          href="/privacy"
          className="inline-block py-2 underline underline-offset-2"
        >
          Privacy
        </Link>{" "}
        ·{" "}
        <Link
          href="/terms"
          className="inline-block py-2 underline underline-offset-2"
        >
          Terms
        </Link>
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  required = false,
  ...input
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  const id = `mc-${name}`;
  return (
    <div>
      <FieldLabel htmlFor={id} required={required} className="mb-1.5 block">
        {label}
      </FieldLabel>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, error && fieldErrorClass)}
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
    </div>
  );
}
