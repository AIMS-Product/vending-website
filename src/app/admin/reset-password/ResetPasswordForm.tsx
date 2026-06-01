"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import {
  ADMIN_AFTER_LOGIN_PATH,
  adminPathWithEmail,
} from "@/lib/supabase/auth-redirects";
import { updatePassword, type UpdatePasswordState } from "./actions";

const initialState: UpdatePasswordState = { status: "idle" };

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(updatePassword, initialState);
  const loginHref = adminPathWithEmail("/admin/login", email);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-950">
            Password updated successfully
          </p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Your admin password was updated successfully. Continue to Studio.
          </p>
        </div>
        <Link
          href={ADMIN_AFTER_LOGIN_PATH}
          className={`${adminPrimaryButtonClass} w-full`}
        >
          Continue to Studio
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label
        htmlFor="password"
        className="block text-sm font-medium text-slate-700"
      >
        New password
        <input
          id="password"
          name="password"
          aria-label="New password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={adminInputClass}
        />
      </label>

      <label
        htmlFor="confirmPassword"
        className="block text-sm font-medium text-slate-700"
      >
        Confirm password
        <input
          id="confirmPassword"
          name="confirmPassword"
          aria-label="Confirm password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={adminInputClass}
        />
      </label>

      <SubmitButton />

      {state.status === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-red-600" role="alert" aria-live="polite">
            {state.message}
          </p>
          <Link
            href={loginHref}
            className={`${adminSecondaryButtonClass} w-full`}
          >
            Back to sign in
          </Link>
        </div>
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
      {pending ? "Updating password..." : "Update password"}
    </button>
  );
}
