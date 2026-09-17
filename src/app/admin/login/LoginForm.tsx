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
import { loginWithPassword, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({
  defaultEmail,
  initialError,
  nextPath,
  guestEnabled,
}: {
  defaultEmail: string;
  initialError: string | null;
  nextPath: string;
  guestEnabled: boolean;
}) {
  const [state, formAction] = useActionState(loginWithPassword, initialState);
  const [email, setEmail] = useState(defaultEmail);
  // Guest is the default whenever it is configured: the people who stall on
  // this form are the ones who do not have an email to type. Staff arriving
  // from a redirect that already knows their address still get the email
  // form, so the daily path is unchanged for them.
  const [guest, setGuest] = useState(guestEnabled && !defaultEmail);
  const forgotPasswordHref = adminPathWithEmail(
    "/admin/forgot-password",
    email,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      {guest ? (
        // The email field is unmounted, not hidden: a `required` input that
        // is merely invisible blocks submit with a tooltip pointing at
        // nothing, which is the exact confusion this mode exists to remove.
        <input type="hidden" name="guest" value="1" />
      ) : (
        <label
          htmlFor="email"
          className="text-ui-text block text-sm font-medium"
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
      )}

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
          // Guests are handed a shared password we do not control the length
          // of; only the email path keeps the 8-character hint.
          minLength={guest ? undefined : 8}
          autoComplete="current-password"
          className={adminInputClass}
        />
      </label>

      <SubmitButton guest={guest} />

      {guestEnabled && (
        <button
          type="button"
          onClick={() => setGuest((current) => !current)}
          className={`${adminSecondaryButtonClass} h-10 w-full`}
        >
          {guest ? "Sign in with email instead" : "Continue as guest"}
        </button>
      )}

      {/* A shared account must not offer a password reset: one guest
          resetting it locks out everyone else holding that password. */}
      {!guest && (
        <div className="flex justify-end">
          <Link
            href={forgotPasswordHref}
            className="text-ui-text-muted hover:text-ui-text text-[0.8125rem] underline-offset-2 transition hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      )}

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

function SubmitButton({ guest }: { guest: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${adminPrimaryButtonClass} mt-1 h-10 w-full`}
    >
      {pending ? "Signing in..." : guest ? "Continue as guest" : "Sign in"}
    </button>
  );
}
