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
    <section className="relative isolate overflow-hidden bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32 lg:pb-28">
      <div className="mx-auto grid max-w-[1250px] gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
            Vending Accelerator
          </p>
          <h1 className="mt-8 text-[clamp(3rem,6vw,5.5rem)] leading-[0.95] font-black text-[#111111] uppercase">
            Apply to build your vending business with Mike.
          </h1>
          <p className="mt-7 text-xl leading-8 font-semibold text-slate-700">
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
