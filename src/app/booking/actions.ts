"use server";

import { submitPublicLeadAction } from "@/app/lead-action-handler";
import type { PublicLeadActionState } from "@/app/lead-action-state";

// Social-ad booking pages: capture the lead as a lightweight "contact" (name +
// email required, phone optional) so the full UTM/source attribution is stored
// in our database, then the form hands the visitor off to the page's Calendly.
// oxlint-disable-next-line react-doctor/server-auth-actions -- Public booking intake must accept unauthenticated prospects.
export async function submitBookingLead(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  return submitPublicLeadAction("contact", formData);
}
