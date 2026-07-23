"use server";

import { headers } from "next/headers";
import type { PublicLeadActionState } from "@/app/lead-action-state";
import {
  createQualificationIntakeSession,
  QualificationIntakeValidationError,
} from "@/lib/services/qualification-intake";
import {
  submitInlineQualification as submitInlineQualificationOrchestrator,
  QualificationSessionValidationError,
} from "@/lib/services/qualification-inline";

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
      vpSessionId: field(formData, "vp_session_id"),
      sourcePath: field(formData, "source_path"),
      landingPath: field(formData, "landing_path"),
      referrer: field(formData, "referrer") || h.get("referer"),
      firstLandingUrl: field(formData, "first_landing_url"),
      firstLandingPath: field(formData, "first_landing_path"),
      firstReferrer: field(formData, "first_referrer"),
      firstTouchAt: field(formData, "first_touch_at"),
      latestLandingUrl: field(formData, "latest_landing_url"),
      latestLandingPath: field(formData, "latest_landing_path"),
      latestReferrer: field(formData, "latest_referrer"),
      latestTouchAt: field(formData, "latest_touch_at"),
      userAgent: h.get("user-agent"),
      sourcePageId: field(formData, "source_page_id"),
      sourcePageSlug: field(formData, "source_page_slug"),
      targetKeyword: field(formData, "target_keyword"),
      sourceBlockId: field(formData, "source_block_id"),
      sourceCtaTrackingName: field(formData, "source_cta_tracking_name"),
      clickedHref: field(formData, "clicked_href"),
      utmSource: field(formData, "utm_source"),
      utmMedium: field(formData, "utm_medium"),
      utmCampaign: field(formData, "utm_campaign"),
      utmTerm: field(formData, "utm_term"),
      utmContent: field(formData, "utm_content"),
      gclid: field(formData, "gclid"),
      fbclid: field(formData, "fbclid"),
      gbraid: field(formData, "gbraid"),
      wbraid: field(formData, "wbraid"),
      paidPlatform: field(formData, "paid_platform"),
      paidSourceKey: field(formData, "paid_source_key"),
      campaignId: field(formData, "campaign_id"),
      campaignName: field(formData, "campaign_name"),
      adsetId: field(formData, "adset_id"),
      adsetName: field(formData, "adset_name"),
      adGroupId: field(formData, "ad_group_id"),
      adGroupName: field(formData, "ad_group_name"),
      groupId: field(formData, "group_id"),
      groupName: field(formData, "group_name"),
      adId: field(formData, "ad_id"),
      adName: field(formData, "ad_name"),
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

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public qualification intake must accept unauthenticated prospects.
export async function submitInlineQualification(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();

  try {
    const result = await submitInlineQualificationOrchestrator({
      idempotencyKey: field(formData, "idempotency_key"),
      fullName: field(formData, "full_name"),
      email: field(formData, "email"),
      phone: field(formData, "phone"),
      qualificationFormId: field(formData, "qualification_form_id"),
      completionRedirectPath: field(
        formData,
        "qualification_completion_redirect_path",
      ),
      vpSessionId: field(formData, "vp_session_id"),
      sourcePath: field(formData, "source_path"),
      landingPath: field(formData, "landing_path"),
      referrer: field(formData, "referrer") || h.get("referer"),
      firstLandingUrl: field(formData, "first_landing_url"),
      firstLandingPath: field(formData, "first_landing_path"),
      firstReferrer: field(formData, "first_referrer"),
      firstTouchAt: field(formData, "first_touch_at"),
      latestLandingUrl: field(formData, "latest_landing_url"),
      latestLandingPath: field(formData, "latest_landing_path"),
      latestReferrer: field(formData, "latest_referrer"),
      latestTouchAt: field(formData, "latest_touch_at"),
      userAgent: h.get("user-agent"),
      sourcePageId: field(formData, "source_page_id"),
      sourcePageSlug: field(formData, "source_page_slug"),
      targetKeyword: field(formData, "target_keyword"),
      sourceBlockId: field(formData, "source_block_id"),
      sourceCtaTrackingName: field(formData, "source_cta_tracking_name"),
      clickedHref: field(formData, "clicked_href"),
      utmSource: field(formData, "utm_source"),
      utmMedium: field(formData, "utm_medium"),
      utmCampaign: field(formData, "utm_campaign"),
      utmTerm: field(formData, "utm_term"),
      utmContent: field(formData, "utm_content"),
      gclid: field(formData, "gclid"),
      fbclid: field(formData, "fbclid"),
      gbraid: field(formData, "gbraid"),
      wbraid: field(formData, "wbraid"),
      paidPlatform: field(formData, "paid_platform"),
      paidSourceKey: field(formData, "paid_source_key"),
      campaignId: field(formData, "campaign_id"),
      campaignName: field(formData, "campaign_name"),
      adsetId: field(formData, "adset_id"),
      adsetName: field(formData, "adset_name"),
      adGroupId: field(formData, "ad_group_id"),
      adGroupName: field(formData, "ad_group_name"),
      groupId: field(formData, "group_id"),
      groupName: field(formData, "group_name"),
      adId: field(formData, "ad_id"),
      adName: field(formData, "ad_name"),
      consentUpdates: field(formData, "consent_updates") === "true",
      consentContact: field(formData, "consent_contact") === "true",
      timeline: field(formData, "timeline"),
      invest: field(formData, "invest"),
    });

    return {
      status: "success",
      message: "Thanks — here's your fit.",
      leadId: result.leadId,
      qualification: {
        thankYouState: result.thankYouState,
        score: result.score,
      },
    };
  } catch (error) {
    if (
      error instanceof QualificationIntakeValidationError ||
      error instanceof QualificationSessionValidationError
    ) {
      return {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: error.fieldErrors,
      };
    }

    console.error("inline qualification action failed", {
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
