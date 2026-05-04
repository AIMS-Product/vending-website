import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { submitApplicationLead } from "./actions";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Apply to the Vending Accelerator Program — mentorship and tools to launch a profitable vending business.",
  alternates: {
    canonical: "/apply",
  },
};

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(await searchParams, "/apply");

  return (
    <section className="relative isolate overflow-hidden px-6 pt-32 pb-20 lg:px-10 lg:pt-40 lg:pb-28">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-soft)]" />
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="text-brand-600 text-sm font-semibold tracking-[0.08em] uppercase">
            Vending Accelerator
          </p>
          <h1 className="text-brand-500 mt-4 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Apply to build your vending business with Mike.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Share where you are now, where you want to launch, and what kind of
            support would move the business forward.
          </p>
        </div>

        <PublicLeadForm
          action={submitApplicationLead}
          attribution={attribution}
          idempotencyKey={randomUUID()}
          intent="apply"
          submitLabel="Submit application"
        />
      </div>
    </section>
  );
}
