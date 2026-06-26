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
      sourcePageId: field(formData, "source_page_id"),
      sourcePageSlug: field(formData, "source_page_slug"),
      targetKeyword: field(formData, "target_keyword"),
      sourceBlockId: field(formData, "source_block_id"),
      sourceCtaTrackingName: field(formData, "source_cta_tracking_name"),
      clickedHref: field(formData, "clicked_href"),
      userAgent: h.get("user-agent"),
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
