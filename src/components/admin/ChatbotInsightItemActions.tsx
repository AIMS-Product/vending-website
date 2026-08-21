"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ChatbotActionState } from "@/app/admin/chatbot/actions";
import {
  adminSecondaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";

const initialState: ChatbotActionState = { status: "idle" };

type FormActionFn = (
  prevState: ChatbotActionState,
  formData: FormData,
) => Promise<ChatbotActionState>;

/**
 * Shared "primary action + dismiss" row for every card on
 * /admin/chatbot/insights (follow-up tasks, objections, knowledge fixes,
 * site recommendations) — same two-button, one-status-line shape, four
 * different server actions passed in from the server-rendered list.
 */
export function ChatbotInsightItemActions({
  id,
  primaryLabel,
  primaryAction,
  dismissAction,
}: {
  id: string;
  primaryLabel: string;
  primaryAction: FormActionFn;
  dismissAction: FormActionFn;
}) {
  const [primaryState, primaryFormAction] = useActionState(
    primaryAction,
    initialState,
  );
  const [dismissState, dismissFormAction] = useActionState(
    dismissAction,
    initialState,
  );
  const state = dismissState.status !== "idle" ? dismissState : primaryState;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <form action={primaryFormAction}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton
          label={primaryLabel}
          className={adminSecondaryButtonClass}
        />
      </form>
      <form action={dismissFormAction}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton label="Dismiss" className={adminSmallButtonClass} />
      </form>
      {state.status !== "idle" ? (
        <span
          className={`text-xs font-medium ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </span>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Working…" : label}
    </button>
  );
}
