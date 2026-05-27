"use server";

import { submitPublicLeadAction } from "@/app/lead-action-handler";
import type { PublicLeadActionState } from "@/app/lead-action-state";

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public contact intake must accept unauthenticated prospects.
export async function submitContactLead(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  return submitPublicLeadAction("contact", formData);
}
