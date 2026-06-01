"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { adminPathWithEmail } from "@/lib/supabase/auth-redirects";
import { requestPasswordReset, type PasswordResetState } from "./actions";

const initialState: PasswordResetState = { status: "idle" };

export function ForgotPasswordForm({
  defaultEmail,
  initialError,
}: {
  defaultEmail: string;
  initialError: string | null;
}) {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialState,
  );
  const [email, setEmail] = useState(defaultEmail);
  const loginHref = adminPathWithEmail("/admin/login", email);

  if (state.status === "sent") {
    const sentLoginHref = adminPathWithEmail("/admin/login", state.email);

    return (
      <div className="space-y-4 text-sm text-slate-700">
        <p className="text-base font-semibold text-slate-950">
          Check your email
        </p>
        <p>
          If <span className="font-medium text-slate-950">{state.email}</span>{" "}
          has Studio access, a password reset email is on its way.
        </p>
        <Link
          href={sentLoginHref}
          className={`${adminSecondaryButtonClass} w-full`}
        >
          Back to sign in
        </Link>
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
          aria-label="Email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          placeholder="you@vendingpreneurs.com"
          className={adminInputClass}
        />
      </label>

      <SubmitButton />

      <Link href={loginHref} className={`${adminSecondaryButtonClass} w-full`}>
        Back to sign in
      </Link>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {state.message}
        </p>
      )}

      {initialError && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {initialError}
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
      className={`${adminPrimaryButtonClass} w-full`}
    >
      {pending ? "Sending reset..." : "Send password reset"}
    </button>
  );
}
