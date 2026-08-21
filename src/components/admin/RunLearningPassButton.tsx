"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  runChatbotLearningPassAction,
  type ChatbotActionState,
} from "@/app/admin/chatbot/actions";
import { adminPrimaryButtonClass } from "@/components/admin/AdminUi";

const initialState: ChatbotActionState = { status: "idle" };

export function RunLearningPassButton() {
  // runChatbotLearningPassAction takes no arguments — useActionState always
  // calls the action with (prevState, formData), but TS permits a
  // narrower-arity function wherever the wider one is expected (same
  // pattern as sendChatbotTestEmailAction in ChatbotLeadRoutingPanel.tsx).
  const [state, formAction] = useActionState(
    runChatbotLearningPassAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <SubmitButton />
      {state.status !== "idle" ? (
        <p
          className={`text-xs font-medium ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminPrimaryButtonClass}
    >
      {pending ? "Running…" : "Run learning pass"}
    </button>
  );
}
