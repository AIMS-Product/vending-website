"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  adminRetryCloseSyncEvent,
  LeadAdminServiceError,
} from "@/lib/services/lead-admin";
import { requireAdmin } from "@/lib/supabase/auth";

export type LeadAdminActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const retrySchema = z.object({
  eventId: z.string().trim().min(1, "Close sync event is required."),
  leadId: z.string().trim().min(1, "Lead is required."),
});

export async function retryCloseSyncEvent(
  _prev: LeadAdminActionState,
  formData: FormData,
): Promise<LeadAdminActionState> {
  const { user } = await requireAdmin();
  const parsed = retrySchema.safeParse({
    eventId: formData.get("eventId"),
    leadId: formData.get("leadId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid retry request.",
    };
  }

  try {
    await adminRetryCloseSyncEvent({
      eventId: parsed.data.eventId,
      requestedBy: user.id,
    });
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${parsed.data.leadId}`);
    return { status: "saved", message: "Close sync retry queued." };
  } catch (error) {
    if (error instanceof LeadAdminServiceError) {
      return { status: "error", message: error.message };
    }

    console.error("lead admin retry action failed", error);
    return {
      status: "error",
      message: "Could not queue Close sync retry.",
    };
  }
}
