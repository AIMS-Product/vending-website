"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import {
  buildGhlForwardPayload,
  forwardLeadToGhl,
  resolveGhlForwardTarget,
  GhlForwardConfigError,
  GhlForwardError,
  LEAD_CAPTURE_TYPES,
  type LeadCaptureType,
} from "@/lib/ghl/forward";
import {
  adminUpdateLeadForwardSettings,
  getLeadForwardSettings,
  LeadForwardSettingsError,
} from "@/lib/services/lead-forward-settings";
import {
  AdminAuthorizationError,
  requireSuperAdmin,
} from "@/lib/supabase/auth";

export type LeadForwardActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const PATH = "/admin/settings/lead-forwarding";

export async function saveLeadForwarding(
  _prev: LeadForwardActionState,
  formData: FormData,
): Promise<LeadForwardActionState> {
  try {
    const { user } = await requireSuperAdmin();
    await adminUpdateLeadForwardSettings(
      {
        enabled: formData.get("enabled") === "on",
        webhookUrl: String(formData.get("webhookUrl") ?? "").trim() || null,
        captureTypes: LEAD_CAPTURE_TYPES.filter((type) =>
          formData.getAll("captureTypes").includes(type),
        ) as LeadCaptureType[],
        trafficSourceMode:
          formData.get("trafficSourceMode") === "allowlist"
            ? "allowlist"
            : "all",
        trafficSources: formData
          .getAll("trafficSources")
          .map((value) => String(value)),
        fieldIds: fieldIdsFromForm(formData),
      },
      { updatedBy: user.email ?? "unknown" },
    );
    revalidatePath(PATH);
    return { status: "saved", message: "Lead forwarding saved." };
  } catch (error) {
    return actionError(error, "Could not save lead forwarding.");
  }
}

/**
 * Send one clearly-marked sample to the destination.
 *
 * This is the partner's setup step as much as our check: GoHighLevel's
 * inbound-webhook trigger can only build a field mapping from a request it has
 * actually received, so their ops team needs us to press this while they watch.
 */
export async function sendLeadForwardTest(
  _prev: LeadForwardActionState,
  formData: FormData,
): Promise<LeadForwardActionState> {
  try {
    await requireSuperAdmin();
    const settings = await getLeadForwardSettings();
    const target = resolveGhlForwardTarget(config, settings);
    const captureType: LeadCaptureType =
      formData.get("captureType") === "application" ? "application" : "booking";

    await forwardLeadToGhl(
      buildGhlForwardPayload({
        formType: captureType,
        fullName: "Sample Lead (test)",
        email: `wescale-test-${Date.now()}@vendingpreneurs-test.com`,
        phone: "+15415550123",
        submittedAt: new Date().toISOString(),
        sourcePage: captureType === "application" ? "/" : "/booking-youtube",
        utmSource: "youtube",
        utmMedium: "video",
        utmCampaign: "buy-first-machine",
        utmContent: "desc-link-1",
        ...(captureType === "application"
          ? {
              city: "Phoenix",
              stateRegion: "Arizona",
              businessStage: "Researching vending",
              budget: "$5k-$10k",
              timeline: "Immediately",
            }
          : {}),
      }),
      target,
    );

    return {
      status: "saved",
      message: `Test ${captureType} sent. Their team can now map the fields from it.`,
    };
  } catch (error) {
    return actionError(error, "Could not send the test lead.");
  }
}

function fieldIdsFromForm(formData: FormData): Record<string, string> {
  const fieldIds: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("fieldId:")) continue;
    const id = String(value).trim();
    if (id) fieldIds[key.slice("fieldId:".length)] = id;
  }
  return fieldIds;
}

function actionError(error: unknown, fallback: string): LeadForwardActionState {
  if (error instanceof AdminAuthorizationError) {
    return {
      status: "error",
      message: "Only super admins can change lead forwarding.",
    };
  }
  if (
    error instanceof LeadForwardSettingsError ||
    error instanceof GhlForwardConfigError
  ) {
    return { status: "error", message: error.message };
  }
  if (error instanceof GhlForwardError) {
    return {
      status: "error",
      message: `The destination rejected it: ${error.message}`,
    };
  }

  console.error("lead forwarding action failed", error);
  return { status: "error", message: fallback };
}
