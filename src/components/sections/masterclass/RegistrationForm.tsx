"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  registerForMasterclass,
  type RegistrationState,
} from "@/app/masterclass/actions";
import { buttonClass } from "@/components/ui/Button";
import { FieldLabel, fieldClass, fieldErrorClass } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { HONEYPOT_FIELD, SMS_CONSENT_TEXT } from "@/lib/content/masterclass";

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

  return (
    <form
      action={action}
      noValidate
      className="rounded-card border-ink shadow-card border-2 bg-white p-6 sm:p-7"
    >
      <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
        Free seat
      </p>
      <p className="text-ink mt-2 text-2xl font-black uppercase">
        Save my seat
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
          defaultValue={values?.firstName}
          error={errors.firstName}
        />
        <Field
          name="lastName"
          label="Last name"
          autoComplete="family-name"
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

      <label className="mt-4 flex items-start gap-3 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          name="smsConsent"
          required
          defaultChecked={values?.smsConsent}
          aria-invalid={errors.smsConsent ? true : undefined}
          aria-describedby={errors.smsConsent ? "smsConsent-error" : undefined}
          className="mt-0.5 size-4 shrink-0 accent-[#1f72a5]"
        />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>
      {errors.smsConsent ? (
        <p
          id="smsConsent-error"
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

      <p className="mt-3 text-center text-xs text-slate-500">
        Free. Takes 20 seconds.{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline underline-offset-2">
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
          className="mt-1 text-xs font-semibold text-red-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
