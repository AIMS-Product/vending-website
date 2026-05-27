"use server";

import { submitPublicLeadAction } from "@/app/lead-action-handler";
import type { PublicLeadActionState } from "@/app/lead-action-state";

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public application intake must accept unauthenticated prospects.
export async function submitApplicationLead(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  return submitPublicLeadAction("apply", formData);
}
