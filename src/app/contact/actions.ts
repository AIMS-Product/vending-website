"use server";

import { submitPublicLeadAction } from "@/app/lead-action-handler";
import type { PublicLeadActionState } from "@/app/lead-action-state";

export async function submitContactLead(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  return submitPublicLeadAction("contact", formData);
}
