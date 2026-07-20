import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { ApplyPageContent } from "@/components/sections/ApplyPageContent";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { submitApplicationLead } from "@/app/apply/actions";

// Live demo of the "our form -> Calendly" handoff. The native form captures the
// lead in the CRM on submit, then sends the visitor to Calendly to pick a time
// with their name and email pre-filled. Not part of the public site — noindexed
// and kept out of navigation, purely for showing the flow.
const DEMO_CALENDLY_URL =
  "https://calendly.com/d/cxwj-zxk-2z4/vending-route-advisory-call";

export const metadata: Metadata = {
  title: "Demo — Book a call",
  robots: { index: false, follow: false },
  alternates: { canonical: "/demo/book-a-call" },
};

export default async function DemoBookACallPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(
    await searchParams,
    "/demo/book-a-call",
  );

  return (
    <ApplyPageContent
      action={submitApplicationLead}
      attribution={attribution}
      idempotencyKey={randomUUID()}
      eyebrow="Book your advisory call"
      title="Tell us about your vending goals, then pick a time."
      description="Fill this out and you'll jump straight to the calendar to lock in your call — no back and forth. Your details carry over automatically."
      submitLabel="Continue to booking"
      bookingRedirectUrl={DEMO_CALENDLY_URL}
    />
  );
}
