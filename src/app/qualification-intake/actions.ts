"use server";

import { headers } from "next/headers";
import type { PublicLeadActionState } from "@/app/lead-action-state";
import {
  createQualificationIntakeSession,
  QualificationIntakeValidationError,
} from "@/lib/services/qualification-intake";

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public qualification intake must accept unauthenticated prospects.
export async function submitQualificationLead(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();

  try {
    const result = await createQualificationIntakeSession({
      idempotencyKey: field(formData, "idempotency_key"),
      fullName: field(formData, "full_name"),
      email: field(formData, "email"),
      phone: field(formData, "phone"),
      qualificationFormId: field(formData, "qualification_form_id"),
      completionRedirectPath: field(
        formData,
        "qualification_completion_redirect_path",
      ),
      sourcePath: field(formData, "source_path"),
      landingPath: field(formData, "landing_path"),
      referrer: field(formData, "referrer") || h.get("referer"),
      userAgent: h.get("user-agent"),
      sourcePageId: field(formData, "source_page_id"),
      sourcePageSlug: field(formData, "source_page_slug"),
      targetKeyword: field(formData, "target_keyword"),
      sourceBlockId: field(formData, "source_block_id"),
      sourceCtaTrackingName: field(formData, "source_cta_tracking_name"),
      utmSource: field(formData, "utm_source"),
      utmMedium: field(formData, "utm_medium"),
      utmCampaign: field(formData, "utm_campaign"),
      utmTerm: field(formData, "utm_term"),
      utmContent: field(formData, "utm_content"),
      experimentKey: field(formData, "qualification_experiment_key"),
      variantKey: field(formData, "qualification_variant_key"),
    });

    return {
      status: "success",
      message: "Continue to qualification.",
      leadId: result.leadId,
      redirectHref: result.qualificationUrl,
    };
  } catch (error) {
    if (error instanceof QualificationIntakeValidationError) {
      return {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: error.fieldErrors,
      };
    }

    console.error("qualification intake action failed", {
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
