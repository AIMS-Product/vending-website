"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminDeleteLead,
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

const deleteSchema = z.object({
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

export async function deleteLead(
  _prev: LeadAdminActionState,
  formData: FormData,
): Promise<LeadAdminActionState> {
  await requireAdmin();
  const parsed = deleteSchema.safeParse({ leadId: formData.get("leadId") });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid delete request.",
    };
  }

  try {
    await adminDeleteLead({ leadId: parsed.data.leadId });
  } catch (error) {
    if (error instanceof LeadAdminServiceError) {
      return { status: "error", message: error.message };
    }

    console.error("lead admin delete action failed", error);
    return { status: "error", message: "Could not delete lead." };
  }

  // revalidate + redirect must run outside the try/catch so the NEXT_REDIRECT
  // control-flow error isn't swallowed as a failed delete.
  revalidatePath("/admin/leads");
  redirect("/admin/leads?deleted=1");
}
