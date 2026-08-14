"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import type { PublicLeadActionState } from "@/app/lead-action-state";
import { adminRunCloseSync } from "@/lib/close/sync";
import {
  checkPublicRateLimit,
  requestIp,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";
import { notifyQualificationLead } from "@/lib/services/leads";
import {
  createQualificationIntakeSession,
  QualificationIntakeValidationError,
} from "@/lib/services/qualification-intake";
import {
  finishInlineQualification as finishInlineQualificationOrchestrator,
  startInlineQualification as startInlineQualificationOrchestrator,
  submitInlineQualification as submitInlineQualificationOrchestrator,
  QualificationSessionValidationError,
} from "@/lib/services/qualification-inline";
import {
  finishNewsletterSubscription,
  startNewsletterSubscription,
} from "@/lib/services/newsletter-signup";

type CapturedLead = Parameters<typeof notifyQualificationLead>[0];

/**
 * Alert the team and push the lead to Close without making the visitor wait.
 * `after` runs once the response has been sent, so the inline fit result still
 * renders immediately while Slack and Close land a second or two behind it.
 *
 * Both steps are best-effort by design: the lead is already committed, and the
 * Close cron re-sweeps the queue, so a failure here costs speed, never data.
 */
function deliverCapturedLead(lead: CapturedLead) {
  try {
    scheduleDelivery(lead);
  } catch (error) {
    // `after` needs a request scope. If it is ever unavailable, the lead is
    // still captured and the cron still syncs it — do not fail the submission.
    console.warn("could not schedule lead delivery", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function scheduleDelivery(lead: CapturedLead) {
  after(async () => {
    try {
      const notified = await notifyQualificationLead(lead);
      if (!notified.ok) {
        console.warn("qualification lead notification failed", {
          error: notified.error,
        });
      }
    } catch (error) {
      console.error("qualification lead notification threw", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }

    await drainCloseSync();
  });
}

/**
 * Push the queued Close events without re-alerting the team. Stage 2 of the
 * two-stage form enriches a lead the team was already told about at stage 1,
 * so it drains the queue only.
 */
function deliverQualificationAnswers() {
  try {
    after(drainCloseSync);
  } catch (error) {
    // `after` needs a request scope. The enrichment event is already queued
    // and the cron re-sweeps it, so a failure here costs speed, never data.
    console.warn("could not schedule close sync", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

/**
 * Every action in this file is a public, unauthenticated write. They share one
 * window so a flood cannot simply rotate between the one-shot and two-stage
 * entry points to get four budgets instead of one.
 */
async function throttled(h: Headers, email?: string) {
  const allowed = await checkPublicRateLimit("qualification_intake", {
    ip: requestIp(h),
    email,
  });
  return allowed
    ? null
    : ({
        status: "error",
        message: TOO_MANY_REQUESTS_MESSAGE,
      } satisfies PublicLeadActionState);
}

async function drainCloseSync() {
  try {
    await adminRunCloseSync();
  } catch (error) {
    console.error("close sync after lead capture failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public qualification intake must accept unauthenticated prospects.
export async function submitQualificationLead(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();
  const limited = await throttled(h, field(formData, "email"));
  if (limited) return limited;

  try {
    const result = await createQualificationIntakeSession({
      ...intakeFieldsFromFormData(formData, h),
      experimentKey: field(formData, "qualification_experiment_key"),
      variantKey: field(formData, "qualification_variant_key"),
    });

    deliverCapturedLead(capturedLeadFromFormData(formData));

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
  const limited = await throttled(h, field(formData, "email"));
  if (limited) return limited;

  try {
    const result = await submitInlineQualificationOrchestrator({
      ...intakeFieldsFromFormData(formData, h),
      consentUpdates: field(formData, "consent_updates") === "true",
      consentContact: field(formData, "consent_contact") === "true",
      operator: field(formData, "operator"),
      persona: field(formData, "persona"),
      confidence: field(formData, "confidence"),
      bottleneck: field(formData, "bottleneck"),
      timeline: field(formData, "timeline"),
      invest: field(formData, "invest"),
    });

    deliverCapturedLead(
      capturedLeadFromFormData(formData, {
        timeline: field(formData, "timeline"),
        budget: field(formData, "invest"),
      }),
    );

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

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public qualification intake must accept unauthenticated prospects.
export async function startInlineQualification(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();
  const limited = await throttled(h, field(formData, "email"));
  if (limited) return limited;

  try {
    const result = await startInlineQualificationOrchestrator({
      ...intakeFieldsFromFormData(formData, h),
      consentUpdates: field(formData, "consent_updates") === "true",
      consentContact: field(formData, "consent_contact") === "true",
    });

    // The lead exists and has consented as of here, so the team hears about it
    // now — even if the visitor never answers the questions in stage 2.
    deliverCapturedLead(capturedLeadFromFormData(formData));

    return {
      status: "success",
      message: "Got your details. A few quick questions.",
      leadId: result.leadId,
      sessionToken: result.sessionToken,
    };
  } catch (error) {
    return inlineQualificationErrorState(error, "inline qualification start");
  }
}

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public qualification intake must accept unauthenticated prospects.
export async function finishInlineQualification(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();
  // Stage 2 carries a session token, not an address, so this one keys on IP.
  const limited = await throttled(h);
  if (limited) return limited;

  try {
    const result = await finishInlineQualificationOrchestrator({
      sessionToken: field(formData, "session_token"),
      operator: field(formData, "operator"),
      persona: field(formData, "persona"),
      confidence: field(formData, "confidence"),
      bottleneck: field(formData, "bottleneck"),
      timeline: field(formData, "timeline"),
      invest: field(formData, "invest"),
      userAgent: h.get("user-agent"),
    });

    deliverQualificationAnswers();

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
    return inlineQualificationErrorState(error, "inline qualification finish");
  }
}

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public newsletter signup must accept unauthenticated prospects.
export async function startNewsletterSignup(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();
  const limited = await throttled(h, field(formData, "email"));
  if (limited) return limited;

  try {
    const result = await startNewsletterSubscription({
      ...intakeFieldsFromFormData(formData, h),
      newsletterEmailConsent:
        field(formData, "newsletter_email_consent") === "true",
      programUpdatesConsent:
        field(formData, "program_updates_consent") === "true",
    });

    deliverCapturedLead(
      capturedLeadFromFormData(formData, { formType: "newsletter" }),
    );
    return {
      status: "success",
      message: "You're in. Two quick questions.",
      leadId: result.leadId,
      sessionToken: result.sessionToken,
    };
  } catch (error) {
    return inlineQualificationErrorState(error, "newsletter signup start");
  }
}

// oxlint-disable-next-line react-doctor/server-auth-actions -- Public newsletter signup must accept unauthenticated prospects.
export async function finishNewsletterSignup(
  _prev: PublicLeadActionState,
  formData: FormData,
): Promise<PublicLeadActionState> {
  const h = await headers();
  const limited = await throttled(h);
  if (limited) return limited;

  try {
    const result = await finishNewsletterSubscription({
      sessionToken: field(formData, "session_token"),
      phone: field(formData, "phone"),
      smsUpdatesConsent: field(formData, "sms_updates_consent") === "true",
      pullToLaunch: fields(formData, "pull_to_launch"),
      learnMost: fields(formData, "learn_most"),
      userAgent: h.get("user-agent"),
    });

    deliverQualificationAnswers();
    return {
      status: "success",
      message: "Welcome to The Route.",
      leadId: result.leadId,
    };
  } catch (error) {
    return inlineQualificationErrorState(error, "newsletter signup finish");
  }
}

function inlineQualificationErrorState(
  error: unknown,
  context: string,
): PublicLeadActionState {
  if (
    error instanceof QualificationIntakeValidationError ||
    error instanceof QualificationSessionValidationError
  ) {
    // A session-level failure (expired, unknown, already submitted) has no
    // field to highlight, so it needs to speak for itself.
    if (error.fieldErrors.session) {
      return {
        status: "error",
        message: `${error.fieldErrors.session[0]} Refresh the page to start again.`,
      };
    }
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: error.fieldErrors,
    };
  }

  console.error(`${context} action failed`, {
    error: error instanceof Error ? error.message : "unknown error",
  });
  return {
    status: "error",
    message: "We couldn't submit the form. Try again in a moment.",
  };
}

/**
 * The lead/attribution fields every qualification action forwards to the
 * intake service, read straight off the posted form. Shared so the one-shot
 * and two-stage paths cannot drift on which attribution reaches Close.
 */
function intakeFieldsFromFormData(formData: FormData, h: Headers) {
  return {
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
  };
}

function capturedLeadFromFormData(
  formData: FormData,
  options: Partial<Pick<CapturedLead, "timeline" | "budget">> & {
    formType?: CapturedLead["formType"];
  } = {},
): CapturedLead {
  const { formType = "apply", ...answers } = options;
  return {
    formType,
    fullName: field(formData, "full_name"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    sourcePath: field(formData, "source_path"),
    landingPath: field(formData, "landing_path"),
    sourcePageSlug: field(formData, "source_page_slug"),
    sourceCtaTrackingName: field(formData, "source_cta_tracking_name"),
    utmSource: field(formData, "utm_source"),
    utmMedium: field(formData, "utm_medium"),
    utmCampaign: field(formData, "utm_campaign"),
    ...answers,
  };
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fields(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}
