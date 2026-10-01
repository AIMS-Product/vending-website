"use client";

import { useActionState } from "react";
import {
  submitPortalIntake,
  type IntakeState,
} from "@/app/portal/[token]/actions";
import type { PortalData } from "@/lib/portal/types";

const FIELD =
  "mt-1 block w-full rounded-[8px] border-2 border-[#111111] bg-white px-3 py-2.5 text-[15px] font-semibold text-[#111111] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none";
const LABEL = "block text-sm font-black text-[#111111]";

export function PortalIntakeForm({
  token,
  defaults,
}: {
  token: string;
  defaults: PortalData["prospect"];
}) {
  const [state, action, pending] = useActionState<IntakeState, FormData>(
    submitPortalIntake,
    { status: "idle" },
  );

  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="token" value={token} />
      <label className={LABEL}>
        What do you do for work?
        <input
          name="occupation"
          defaultValue={defaults.occupation ?? ""}
          placeholder="e.g. Nurse, business owner"
          className={FIELD}
          maxLength={120}
        />
      </label>
      <label className={LABEL}>
        ZIP code
        <input
          name="zip"
          defaultValue={defaults.zip ?? ""}
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={5}
          className={FIELD}
        />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        What would you want vending to do for you?{" "}
        <span className="font-semibold text-slate-600">(optional)</span>
        <input
          name="goal"
          defaultValue={defaults.goal ?? ""}
          placeholder="e.g. Replace my income in two years"
          className={FIELD}
          maxLength={300}
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center rounded-[10px] border-2 border-[#111111] bg-[#1f72a5] px-6 text-sm font-black text-white uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Tailor my page"}
        </button>
        {state.message ? (
          <p
            role="status"
            className={`text-sm font-semibold ${state.status === "error" ? "text-[#7f1d1d]" : "text-[#14532d]"}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
