"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

export interface ChatCaptureValues {
  name: string;
  email: string;
  phone: string;
}

interface ChatCaptureFormProps {
  /** "gate" fills the whole panel before chat starts (pre_chat mode); "inline" sits in the transcript flow (on_intent mode). */
  variant: "gate" | "inline";
  brandColor: string;
  onSubmit: (values: ChatCaptureValues) => Promise<boolean>;
  onDismiss?: () => void;
  title: string;
  body: string;
}

/**
 * The one capture form both capture modes use — see spec §Widget. Only email
 * is required (submitLead needs a valid email; see lead-capture.ts). Name and
 * phone are offered but optional so the form never blocks on data the
 * visitor doesn't want to give.
 */
export function ChatCaptureForm({
  variant,
  brandColor,
  onSubmit,
  onDismiss,
  title,
  body,
}: ChatCaptureFormProps) {
  const [values, setValues] = useState<ChatCaptureValues>({
    name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const ok = await onSubmit(values);
      if (!ok) setError("Could not save your details. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-3 rounded-[8px] border-2 border-[#111111] bg-[#f8fafc] p-4",
        variant === "gate" && "flex-1 justify-center",
      )}
    >
      <div>
        <p className="text-sm font-black text-[#111111]">{title}</p>
        <p className="mt-1 text-sm text-[#374151]">{body}</p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-bold text-[#374151]">
        Name
        <input
          type="text"
          value={values.name}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, name: event.target.value }))
          }
          className="rounded-[6px] border-2 border-[#111111] px-3 py-2 text-sm text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#066a99]"
          placeholder="Your name"
          autoComplete="name"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-bold text-[#374151]">
        Email
        <input
          type="email"
          required
          value={values.email}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, email: event.target.value }))
          }
          className="rounded-[6px] border-2 border-[#111111] px-3 py-2 text-sm text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#066a99]"
          placeholder="you@email.com"
          autoComplete="email"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-bold text-[#374151]">
        Phone
        <input
          type="tel"
          value={values.phone}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, phone: event.target.value }))
          }
          className="rounded-[6px] border-2 border-[#111111] px-3 py-2 text-sm text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#066a99]"
          placeholder="(555) 555-5555"
          autoComplete="tel"
        />
      </label>

      {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[6px] border-2 border-[#111111] px-4 text-sm font-black text-white uppercase shadow-[3px_3px_0_#111111] disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {submitting ? "Sending..." : "Continue"}
        </button>
        {variant === "inline" && onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-bold text-[#6b7280] underline underline-offset-2 hover:text-[#111111]"
          >
            No thanks
          </button>
        ) : null}
      </div>
    </form>
  );
}
