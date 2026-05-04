import "server-only";

import { headers } from "next/headers";
import {
  LeadValidationError,
  submitLead,
  type SubmitLeadInput,
} from "@/lib/services/leads";
import type { PublicLeadActionState } from "@/app/lead-action-state";

const successMessages: Record<SubmitLeadInput["formType"], string> = {
  apply: "Thanks. We received your details and will follow up shortly.",
  contact: "Thanks. We received your note and will follow up shortly.",
};

export async function submitPublicLeadAction(
  formType: SubmitLeadInput["formType"],
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();

  try {
    const result = await submitLead({
      formType,
      idempotencyKey: field(formData, "idempotency_key"),
      fullName: field(formData, "full_name"),
      email: field(formData, "email"),
      phone: field(formData, "phone"),
      city: field(formData, "city"),
      stateRegion: field(formData, "state_region"),
      businessStage: field(formData, "business_stage"),
      budget: field(formData, "budget"),
      timeline: field(formData, "timeline"),
      message: field(formData, "message"),
      sourcePath: field(formData, "source_path"),
      landingPath: field(formData, "landing_path"),
      referrer: field(formData, "referrer") || h.get("referer"),
      userAgent: h.get("user-agent"),
      utmSource: field(formData, "utm_source"),
      utmMedium: field(formData, "utm_medium"),
      utmCampaign: field(formData, "utm_campaign"),
      utmTerm: field(formData, "utm_term"),
      utmContent: field(formData, "utm_content"),
    });

    return {
      status: "success",
      message: successMessages[formType],
      leadId: result.leadId,
    };
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: error.fieldErrors,
      };
    }

    console.error("lead submission action failed", {
      formType,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      status: "error",
      message: "We couldn't submit the form. Try again in a moment.",
    };
  }
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
