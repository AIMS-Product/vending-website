import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { submitContactLead } from "./actions";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Vendingpreneurs about vending business coaching, locations, machines, and accelerator support.",
  alternates: {
    canonical: "/contact",
  },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(await searchParams, "/contact");

  return (
    <section className="relative isolate overflow-hidden bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32 lg:pb-28">
      <div className="mx-auto grid max-w-[1250px] gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1fr)] lg:items-start">
        <div className="max-w-xl min-w-0">
          <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
            Contact
          </p>
          <h1 className="mt-8 text-[clamp(1.75rem,4.5vw,3rem)] leading-[1.02] font-black [overflow-wrap:anywhere] text-[#111111] uppercase">
            Talk with Vendingpreneurs.
          </h1>
          <p className="mt-7 text-xl leading-8 font-semibold text-slate-700">
            Send the team a note about vending locations, machine decisions,
            partnerships, or accelerator fit.
          </p>
        </div>

        <PublicLeadForm
          action={submitContactLead}
          attribution={attribution}
          idempotencyKey={randomUUID()}
          intent="contact"
          submitLabel="Send message"
        />
      </div>
    </section>
  );
}
