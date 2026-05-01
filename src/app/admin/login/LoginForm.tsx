"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction] = useActionState(requestMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <p className="text-base font-medium text-slate-900">Check your email</p>
        <p>
          We sent a sign-in link to{" "}
          <span className="font-medium text-slate-900">{state.email}</span>.
          Open it on this device to finish signing in. The link expires in
          1&nbsp;hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label
        htmlFor="email"
        className="block text-sm font-medium text-slate-700"
      >
        Email
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@vendingpreneurs.com"
          className="focus:border-brand-400 focus:ring-brand-200 mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:ring-2 focus:outline-none"
        />
      </label>

      <SubmitButton />

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {state.message}
        </p>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-500 hover:bg-brand-600 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending link…" : "Send sign-in link"}
    </button>
  );
}
