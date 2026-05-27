"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import {
  ADMIN_AFTER_LOGIN_PATH,
  buildCodeExchangeUrl,
  extractMagicLinkHashTokens,
  normalizeAdminNextPath,
} from "@/lib/supabase/auth-redirects";
import {
  adminInputClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [state, formAction] = useActionState(requestMagicLink, initialState);
  const [linkError, setLinkError] = useState<string | null>(initialError);

  useEffect(() => {
    const codeExchangeUrl = buildCodeExchangeUrl(window.location.href);
    if (codeExchangeUrl) {
      window.location.replace(codeExchangeUrl);
      return;
    }

    const url = new URL(window.location.href);
    const tokens = extractMagicLinkHashTokens(window.location.hash);
    if (!tokens) return;

    let cancelled = false;
    // Hosted Supabase projects can send implicit-flow magic links unless the
    // email template is customized for PKCE token_hash links. Recover those
    // hash tokens here so either email-template style reaches the admin gate.
    createClient()
      .auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          console.error("magic link hash session failed", error);
          setLinkError("That sign-in link could not be used. Try again.");
          return;
        }
        window.history.replaceState(null, "", "/admin/login");
        window.location.assign(
          normalizeAdminNextPath(url.searchParams.get("next")) ||
            ADMIN_AFTER_LOGIN_PATH,
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          aria-label="Email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@vendingpreneurs.com"
          className={adminInputClass}
        />
      </label>

      <SubmitButton />

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {state.message}
        </p>
      )}

      {linkError && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {linkError}
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
      {pending ? "Sending link…" : "Send sign-in link"}
    </button>
  );
}
