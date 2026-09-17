import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { submitBookingLead } from "@/app/booking/actions";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { HeroFormPanel } from "./HeroFormPanel";

type BookingFormProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
  // The calendar this page books. On a successful submit the lead is captured
  // (with UTM attribution) and this Calendly replaces the form inline — the
  // visitor never leaves the site, matching /contact and /book-now.
  calendlyUrl: string;
};

// The "Book Your Call" card for the social-ad booking pages, rendered in the
// hero's right column (Adam, 2026-09-17). Same panel as the qualification quiz,
// but it holds the simplified contact form (name/email/phone only) and, on
// submit, swaps in the page's Calendly instead of scoring or routing.
export function BookingForm({
  attribution,
  idempotencyKey,
  calendlyUrl,
}: BookingFormProps) {
  return (
    <HeroFormPanel title="Book Your Call">
      <PublicLeadForm
        action={submitBookingLead}
        attribution={attribution}
        bookingEmbedUrl={calendlyUrl}
        idempotencyKey={idempotencyKey}
        intent="contact"
        simpleContact
        submitLabel="Submit"
      />
    </HeroFormPanel>
  );
}
