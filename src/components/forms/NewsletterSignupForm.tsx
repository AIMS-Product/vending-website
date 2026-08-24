"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  initialLeadActionState,
  type PublicLeadActionState,
} from "@/app/lead-action-state";
import {
  NEWSLETTER_LEARN_OPTIONS,
  NEWSLETTER_EMAIL_CONSENT_LABEL,
  NEWSLETTER_PROGRAM_UPDATES_CONSENT_LABEL,
  NEWSLETTER_PULL_OPTIONS,
  NEWSLETTER_QUESTION_IDS,
  NEWSLETTER_SMS_CONSENT_LABEL,
} from "@/lib/content/newsletter";
import { emitPopupConversionIfAttributed } from "@/lib/attribution-client";
import type { LeadAttribution } from "@/lib/lead-attribution";
import {
  formStartEvent,
  leadSubmitErrorEvent,
  leadSubmitEvent,
  pushDataLayerEvent,
} from "@/lib/tracking/lead-events";

export type NewsletterSignupAction = (
  prev: PublicLeadActionState,
  formData: FormData,
) => Promise<PublicLeadActionState>;

type SubmittedValues = Record<string, string | string[]>;

type Props = {
  action: NewsletterSignupAction;
  finishAction: NewsletterSignupAction;
  attribution: LeadAttribution;
  idempotencyKey: string;
  initialState?: PublicLeadActionState;
  initialFinishState?: PublicLeadActionState;
  initialSubmittedValues?: SubmittedValues;
};

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-slate-900 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-300";

export function NewsletterSignupForm({
  action,
  finishAction,
  attribution,
  idempotencyKey,
  initialState = initialLeadActionState,
  initialFinishState = initialLeadActionState,
  initialSubmittedValues = {},
}: Props) {
  const [submitted, setSubmitted] = useState<SubmittedValues>(
    initialSubmittedValues,
  );
  const [state, dispatch, pending] = useActionState(action, initialState);
  const [finishState, finishDispatch, finishPending] = useActionState(
    finishAction,
    initialFinishState,
  );
  const sessionToken = state.status === "success" ? state.sessionToken : null;
  const stage = sessionToken ? 2 : 1;
  const startedSteps = useRef(new Set<number>());
  const stageTwoHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (stage === 2 && finishState.status !== "success") {
      stageTwoHeadingRef.current?.focus();
    }
  }, [finishState.status, stage]);

  useEffect(() => {
    if (state.status === "success") {
      // Stage 1 writes the lead row, so a popup-driven signup converts here.
      emitPopupConversionIfAttributed({ lead_intent: "newsletter" });
      pushDataLayerEvent(
        leadSubmitEvent(attribution, "qualification", 1, {
          leadEmail: stringValue(submitted.email),
          leadPhone: "",
          idempotencyKey,
        }),
      );
    } else if (state.status === "error") {
      pushDataLayerEvent(
        leadSubmitErrorEvent(
          attribution,
          "qualification",
          1,
          Object.keys(state.fieldErrors ?? { form: [state.message] }),
        ),
      );
    }
  }, [attribution, idempotencyKey, state, submitted.email]);

  useEffect(() => {
    if (finishState.status === "success") {
      pushDataLayerEvent(
        leadSubmitEvent(attribution, "qualification", 2, {
          leadEmail: stringValue(submitted.email),
          leadPhone: stringValue(submitted.phone),
          idempotencyKey,
        }),
      );
    } else if (finishState.status === "error") {
      pushDataLayerEvent(
        leadSubmitErrorEvent(
          attribution,
          "qualification",
          2,
          Object.keys(
            finishState.fieldErrors ?? { form: [finishState.message] },
          ),
        ),
      );
    }
  }, [
    attribution,
    finishState,
    idempotencyKey,
    submitted.email,
    submitted.phone,
  ]);

  const markStarted = () => {
    if (startedSteps.current.has(stage)) return;
    startedSteps.current.add(stage);
    pushDataLayerEvent(formStartEvent(attribution, "qualification", stage));
  };

  const stageOneAction = (formData: FormData) => {
    normalizeCheckbox(formData, "newsletter_email_consent");
    normalizeCheckbox(formData, "program_updates_consent");
    setSubmitted((previous) => mergeSubmitted(previous, formData));
    return dispatch(formData);
  };
  const stageTwoAction = (formData: FormData) => {
    normalizeCheckbox(formData, "sms_updates_consent");
    setSubmitted((previous) => mergeSubmitted(previous, formData));
    return finishDispatch(formData);
  };

  if (stage === 2 && finishState.status === "success") {
    return (
      <div
        role="status"
        className="rounded-xl border-2 border-slate-900 bg-amber-50 p-8 text-center shadow-[7px_7px_0_#0f172a]"
      >
        <p className="text-xs font-black tracking-[0.18em] text-[#066a99] uppercase">
          Signup complete
        </p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">
          You&apos;re on The Route
        </h2>
        <p className="mt-3 text-base font-medium text-slate-600">
          Watch your inbox for the next issue from Mike and Anthony.
        </p>
      </div>
    );
  }

  if (stage === 1) {
    return (
      <form
        id="newsletter-signup-step-1"
        action={stageOneAction}
        onFocus={markStarted}
        data-form-step="1"
        data-gtm="newsletter-signup-form"
        className="space-y-5"
      >
        <AttributionFields
          attribution={attribution}
          idempotencyKey={idempotencyKey}
        />
        <TextField
          name="full_name"
          label="Name"
          placeholder="Jordan Reyes"
          autoComplete="name"
          required
          errors={errorsFor(state, "fullName")}
          value={stringValue(submitted.full_name)}
        />
        <TextField
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          errors={errorsFor(state, "email")}
          value={stringValue(submitted.email)}
        />
        <ConsentField
          name="newsletter_email_consent"
          required
          defaultChecked={submitted.newsletter_email_consent === "true"}
          errors={errorsFor(state, NEWSLETTER_QUESTION_IDS.emailConsent)}
        >
          {NEWSLETTER_EMAIL_CONSENT_LABEL}
        </ConsentField>
        <ConsentField
          name="program_updates_consent"
          defaultChecked={submitted.program_updates_consent === "true"}
          errors={errorsFor(
            state,
            NEWSLETTER_QUESTION_IDS.programUpdatesConsent,
          )}
        >
          {NEWSLETTER_PROGRAM_UPDATES_CONSENT_LABEL}
        </ConsentField>
        <SubmitButton pending={pending}>Join The Route — free</SubmitButton>
        <ActionError state={state} />
        <p className="text-center text-xs font-semibold text-slate-500">
          Free forever. No spam, ever. Read our{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    );
  }

  return (
    <form
      id="newsletter-signup-step-2"
      action={stageTwoAction}
      onFocus={markStarted}
      data-form-step="2"
      data-gtm="newsletter-signup-qualification"
      className="space-y-6"
    >
      <input type="hidden" name="session_token" value={sessionToken ?? ""} />
      <p className="text-xs font-black tracking-[0.18em] text-[#066a99] uppercase">
        Step 2 of 2 — optional
      </p>
      <div>
        <h2
          ref={stageTwoHeadingRef}
          tabIndex={-1}
          className="text-2xl font-black text-slate-950 outline-none"
        >
          You&apos;re in. Two quick questions.
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-600">
          These help us make The Route more useful. You can leave everything
          blank and finish.
        </p>
      </div>
      <TextField
        name="phone"
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        errors={errorsFor(finishState, "phone")}
        value={stringValue(submitted.phone)}
      />
      <ConsentField
        name="sms_updates_consent"
        defaultChecked={submitted.sms_updates_consent === "true"}
        errors={errorsFor(
          finishState,
          NEWSLETTER_QUESTION_IDS.smsUpdatesConsent,
        )}
      >
        {NEWSLETTER_SMS_CONSENT_LABEL}
      </ConsentField>
      <ChoiceGroup
        name="pull_to_launch"
        legend="What's pulling you to launch your own business? (optional)"
        options={NEWSLETTER_PULL_OPTIONS}
        selected={arrayValue(submitted.pull_to_launch)}
        errors={errorsFor(finishState, NEWSLETTER_QUESTION_IDS.pullToLaunch)}
      />
      <ChoiceGroup
        name="learn_most"
        legend="What do you want to learn most? (optional)"
        options={NEWSLETTER_LEARN_OPTIONS}
        selected={arrayValue(submitted.learn_most)}
        errors={errorsFor(finishState, NEWSLETTER_QUESTION_IDS.learnMost)}
      />
      <SubmitButton pending={finishPending}>Finish</SubmitButton>
      <ActionError state={finishState} />
    </form>
  );
}

function TextField({
  name,
  label,
  value,
  errors,
  ...inputProps
}: {
  name: string;
  label: string;
  value: string;
  errors?: string[];
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const errorId = `${name}-error`;
  return (
    <label className="block text-sm font-black text-slate-900">
      {label}
      <input
        {...inputProps}
        name={name}
        defaultValue={value}
        aria-invalid={Boolean(errors)}
        aria-describedby={errors ? errorId : undefined}
        className={`${inputClass} mt-2`}
      />
      {errors ? <FieldError id={errorId} errors={errors} /> : null}
    </label>
  );
}

function ConsentField({
  name,
  children,
  defaultChecked,
  required = false,
  errors,
}: {
  name: string;
  children: React.ReactNode;
  defaultChecked: boolean;
  required?: boolean;
  errors?: string[];
}) {
  return (
    <div>
      <label className="flex cursor-pointer gap-3 text-sm leading-6 font-semibold text-slate-700">
        <input
          type="checkbox"
          name={name}
          value="true"
          required={required}
          defaultChecked={defaultChecked}
          className="mt-1 size-5 shrink-0 accent-[#2a8fcc]"
        />
        <span>{children}</span>
      </label>
      {errors ? <FieldError id={`${name}-error`} errors={errors} /> : null}
    </div>
  );
}

function ChoiceGroup({
  name,
  legend,
  options,
  selected,
  errors,
}: {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  errors?: string[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-slate-900">{legend}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 has-checked:border-[#2a8fcc] has-checked:bg-[#eaf6ff]"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="size-4 accent-[#2a8fcc]"
            />
            {option.label}
          </label>
        ))}
      </div>
      {errors ? <FieldError id={`${name}-error`} errors={errors} /> : null}
    </fieldset>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      data-gtm="newsletter-signup-submit"
      className="bg-brand-700 min-h-14 w-full rounded-lg border-2 border-slate-950 px-6 py-3 text-base font-black text-white shadow-[5px_5px_0_#0f172a] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting..." : children}
    </button>
  );
}

function FieldError({ id, errors }: { id: string; errors: string[] }) {
  return (
    <span id={id} className="mt-2 block text-sm font-semibold text-red-700">
      {errors[0]}
    </span>
  );
}

function ActionError({ state }: { state: PublicLeadActionState }) {
  return state.status === "error" ? (
    <p role="alert" className="text-sm font-semibold text-red-700">
      {state.message}
    </p>
  ) : null;
}

function AttributionFields({
  attribution,
  idempotencyKey,
}: {
  attribution: LeadAttribution;
  idempotencyKey: string;
}) {
  return (
    <>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {Object.entries(attribution).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function mergeSubmitted(previous: SubmittedValues, formData: FormData) {
  const next: SubmittedValues = { ...previous };
  const names = new Set(Array.from(formData.keys()));
  for (const name of names) {
    const values = formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string");
    next[name] = values.length > 1 ? values : (values[0] ?? "");
  }
  return next;
}

function stringValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function errorsFor(state: PublicLeadActionState, key: string) {
  return state.status === "error" || state.status === "idle"
    ? state.fieldErrors?.[key]
    : undefined;
}

function normalizeCheckbox(formData: FormData, name: string) {
  formData.set(name, formData.get(name) === "true" ? "true" : "false");
}
