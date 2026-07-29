"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  adminInputClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import { adminPathWithEmail } from "@/lib/supabase/auth-redirects";
import { loginWithPassword, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({
  defaultEmail,
  initialError,
  nextPath,
}: {
  defaultEmail: string;
  initialError: string | null;
  nextPath: string;
}) {
  const [state, formAction] = useActionState(loginWithPassword, initialState);
  const [email, setEmail] = useState(defaultEmail);
  const forgotPasswordHref = adminPathWithEmail(
    "/admin/forgot-password",
    email,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="email" className="text-ui-text block text-sm font-medium">
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

      <label
        htmlFor="password"
        className="text-ui-text block text-sm font-medium"
      >
        Password
        <input
          id="password"
          name="password"
          aria-label="Password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className={adminInputClass}
        />
      </label>

      <SubmitButton />

      <div className="flex justify-end">
        <Link
          href={forgotPasswordHref}
          className="text-ui-text-muted hover:text-ui-text text-[0.8125rem] underline-offset-2 transition hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {state.status === "error" && (
        <p className="text-ui-bad text-sm" role="alert" aria-live="polite">
          {state.message}
        </p>
      )}

      {initialError && (
        <p className="text-ui-bad text-sm" role="alert" aria-live="polite">
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
      className={`${adminPrimaryButtonClass} mt-1 h-10 w-full`}
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}
