"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/app/actions";
import {
  initialSubscribeState,
  type SubscribeState,
} from "@/lib/subscribe-state";

type Props = {
  /** Which block on the page sent this, so attribution survives to the ESP. */
  source: string;
  /** "light" sits on cream, "dark" sits on the deep blue closing band. */
  tone?: "light" | "dark";
  note?: string;
  id?: string;
};

export function SubscribeForm({ source, tone = "light", note, id }: Props) {
  const [state, formAction, pending] = useActionState<SubscribeState, FormData>(
    subscribeAction,
    initialSubscribeState,
  );

  const dark = tone === "dark";

  if (state.status === "success") {
    return (
      <div
        id={id}
        role="status"
        className={`scroll-mt-28 rounded-md border px-5 py-6 ${
          dark
            ? "border-white/25 bg-white/10 text-ink-inverse"
            : "border-rule-strong bg-paper-raised text-ink"
        }`}
      >
        <p
          className={`eyebrow ${dark ? "text-accent-bright" : "text-accent"}`}
        >
          You&apos;re in
        </p>
        <p className="font-display mt-2 text-2xl">Check your inbox.</p>
        <p
          className={`mt-2 text-[0.9375rem] leading-6 ${
            dark ? "text-white/70" : "text-ink-muted"
          }`}
        >
          {state.email
            ? `We sent a confirmation to ${state.email}. The next issue lands within the week.`
            : "The next issue lands within the week."}
        </p>
      </div>
    );
  }

  const invalid = state.status === "error";

  return (
    <form
      id={id}
      action={formAction}
      noValidate
      className="scroll-mt-28"
      aria-describedby={note ? `${source}-note` : undefined}
    >
      <input type="hidden" name="source" value={source} />

      {/* Honeypot — off-screen rather than display:none so bots that skip
          hidden inputs still fill it in. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${source}-company`}>Company</label>
        <input
          id={`${source}-company`}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${source}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${source}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${source}-error` : undefined}
          className={`min-h-12 flex-1 rounded-md border px-4 text-[0.9375rem] outline-none transition ${
            dark
              ? "border-white/40 bg-white/10 text-ink-inverse placeholder:text-white/55 focus:border-accent-bright"
              : "border-rule-control bg-paper-raised text-ink placeholder:text-ink-subtle focus:border-accent"
          } ${invalid ? "border-red-600" : ""}`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`min-h-12 rounded-md px-6 text-[0.9375rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            dark
              ? "bg-paper text-ink hover:bg-white"
              : "bg-accent text-white hover:bg-accent-hover"
          }`}
        >
          {pending ? "Joining…" : "Subscribe"}
        </button>
      </div>

      {invalid && (
        <p
          id={`${source}-error`}
          role="alert"
          className={`mt-2 text-sm ${dark ? "text-red-200" : "text-red-700"}`}
        >
          {state.message}
        </p>
      )}

      {note && (
        <p
          id={`${source}-note`}
          className={`mt-3 text-[0.8125rem] ${
            dark ? "text-white/60" : "text-ink-subtle"
          }`}
        >
          {note}
        </p>
      )}
    </form>
  );
}
