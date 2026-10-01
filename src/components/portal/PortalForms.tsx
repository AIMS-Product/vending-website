"use client";

import { useActionState } from "react";
import {
  askQuestion,
  submitIntake,
  verifyEmail,
  type ActionState,
} from "@/app/portal/[token]/actions";
import { portalCopy } from "@/lib/content/portal";
import type { PortalData } from "@/lib/portal/types";
import { PRIMARY_BUTTON } from "./styles";

const FIELD =
  "mt-1.5 block w-full rounded-[8px] border-2 border-[#111111] bg-white px-3 py-2.5 text-[15px] font-semibold text-[#111111] placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none";
const LABEL = "block text-sm font-black text-[#111111]";

const IDLE: ActionState = { status: "idle" };

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`text-sm font-semibold ${state.status === "error" ? "text-[#7f1d1d]" : "text-[#14532d]"}`}
    >
      {state.message}
    </p>
  );
}

export function IntakeForm({
  token,
  prospect,
}: {
  token: string;
  prospect: PortalData["prospect"];
}) {
  const [state, action, pending] = useActionState(submitIntake, IDLE);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="token" value={token} />
      <label className={LABEL}>
        What do you do for work?
        <input
          name="occupation"
          defaultValue={prospect.occupation ?? ""}
          placeholder="e.g. Nurse, business owner"
          maxLength={120}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        ZIP code
        <input
          name="zip"
          defaultValue={prospect.zip ?? ""}
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={5}
          className={FIELD}
        />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        What would you want vending to do for you?{" "}
        <span className="font-semibold text-slate-500">(optional)</span>
        <input
          name="goal"
          defaultValue={prospect.goal ?? ""}
          placeholder="e.g. Replace my income in two years"
          maxLength={300}
          className={FIELD}
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? "Saving..." : "Tailor my page"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function VerifyForm({
  token,
  emailHint,
}: {
  token: string;
  emailHint?: string | null;
}) {
  const [state, action, pending] = useActionState(verifyEmail, IDLE);
  const demo = token.startsWith("demo");
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-[15px] leading-relaxed font-semibold text-slate-700">
        {portalCopy.verifyBody(emailHint)}
      </p>
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL}>
          6-digit code
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            className={`${FIELD} w-40 tracking-[0.3em]`}
          />
        </label>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? "Checking..." : "Unlock my notes"}
        </button>
      </div>
      {demo ? (
        <p className="text-sm font-semibold text-slate-500">
          {portalCopy.verifyDemoHint}
        </p>
      ) : null}
      <Status state={state} />
    </form>
  );
}

export function AskForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(askQuestion, IDLE);
  if (state.status === "ok") return <Status state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="sr-only" htmlFor="portal-question">
        Your question
      </label>
      <textarea
        id="portal-question"
        name="question"
        rows={3}
        maxLength={1000}
        placeholder={portalCopy.askPlaceholder}
        className={`${FIELD} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? "Sending..." : portalCopy.askSubmit}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
