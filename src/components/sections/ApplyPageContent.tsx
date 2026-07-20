import "server-only";

import {
  PublicLeadForm,
  type PublicLeadFormAction,
} from "@/components/forms/PublicLeadForm";
import type { LeadAttribution } from "@/lib/lead-attribution";

type ApplyPageContentProps = {
  action: PublicLeadFormAction;
  attribution: LeadAttribution;
  idempotencyKey: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  // When set, a successful submit hands the lead off to this Calendly link to
  // pick a time (name/email pre-filled) after the lead is captured.
  bookingRedirectUrl?: string;
};

export function ApplyPageContent({
  action,
  attribution,
  idempotencyKey,
  eyebrow = "Vending Accelerator",
  title = "Apply to build your vending business with Mike.",
  description = "Share where you are now, where you want to launch, and what kind of support would move the business forward.",
  submitLabel = "Submit application",
  bookingRedirectUrl,
}: ApplyPageContentProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32 lg:pb-28">
      <div className="mx-auto grid max-w-[1250px] gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
            {eyebrow}
          </p>
          <h1 className="mt-8 text-[clamp(3rem,6vw,5.5rem)] leading-[0.95] font-black text-[#111111] uppercase">
            {title}
          </h1>
          <p className="mt-7 text-xl leading-8 font-semibold text-slate-700">
            {description}
          </p>
        </div>

        <PublicLeadForm
          action={action}
          attribution={attribution}
          idempotencyKey={idempotencyKey}
          intent="apply"
          submitLabel={submitLabel}
          bookingRedirectUrl={bookingRedirectUrl}
        />
      </div>
    </section>
  );
}
