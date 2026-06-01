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

      <label
        htmlFor="password"
        className="block text-sm font-medium text-slate-700"
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
          className="text-sm font-semibold text-[#0b63f6] transition hover:text-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          Forgot password?
        </Link>
      </div>

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
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}
