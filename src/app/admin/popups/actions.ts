"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  POPUP_TEMPLATES,
  type PopupTemplateFields,
} from "@/lib/content/popups";
import {
  adminCreatePopup,
  adminDeletePopup,
  adminUpdatePopup,
  PopupServiceError,
  SITE_POPUPS_CACHE_TAG,
} from "@/lib/services/popups";
import { requireAdmin } from "@/lib/supabase/auth";
import { attributableUserId } from "@/lib/supabase/dev-auth";

export type PopupActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const ADMIN_POPUPS_PATH = "/admin/popups";

const createSchema = z.object({
  template: z.string().trim().min(1, "Pick a template."),
});

const saveSchema = z.object({
  id: z.uuid("Invalid popup id."),
  status: z.enum(["draft", "active", "paused"]),
});

const idSchema = z.object({
  id: z.uuid("Invalid popup id."),
});

export async function createPopup(
  _prev: PopupActionState,
  formData: FormData,
): Promise<PopupActionState> {
  const { user } = await requireAdmin();
  const parsed = createSchema.safeParse({ template: formData.get("template") });
  if (!parsed.success) return validationError(parsed.error);

  const template = POPUP_TEMPLATES.find(
    (entry) => entry.key === parsed.data.template,
  );
  if (!template) return { status: "error", message: "Unknown template." };

  let redirectTo: string;
  try {
    const created = await adminCreatePopup({
      fields: template.fields,
      createdBy: attributableUserId(user.id),
    });
    revalidatePath(ADMIN_POPUPS_PATH);
    redirectTo = `${ADMIN_POPUPS_PATH}/${created.id}`;
  } catch (error) {
    return actionError(error, "Could not create popup.");
  }

  redirect(redirectTo);
}

export async function savePopup(
  _prev: PopupActionState,
  formData: FormData,
): Promise<PopupActionState> {
  const { user } = await requireAdmin();
  const parsed = saveSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const fields = fieldsFromForm(formData);
  if ("error" in fields) return fields.error;

  try {
    await adminUpdatePopup({
      popupId: parsed.data.id,
      fields: fields.value,
      status: parsed.data.status,
      updatedBy: attributableUserId(user.id),
    });
  } catch (error) {
    return actionError(error, "Could not save popup.");
  }

  revalidatePopupPaths(parsed.data.id);
  return {
    status: "saved",
    message:
      parsed.data.status === "active"
        ? "Saved. This popup is live for visitors."
        : "Popup saved.",
  };
}

export async function deletePopup(
  _prev: PopupActionState,
  formData: FormData,
): Promise<PopupActionState> {
  await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return validationError(parsed.error);

  try {
    await adminDeletePopup(parsed.data.id);
  } catch (error) {
    return actionError(error, "Could not delete popup.");
  }

  revalidatePopupPaths(parsed.data.id);
  redirect(ADMIN_POPUPS_PATH);
}

function revalidatePopupPaths(popupId: string) {
  revalidatePath(ADMIN_POPUPS_PATH);
  revalidatePath(`${ADMIN_POPUPS_PATH}/${popupId}`);
  // Visitor pages read popups through this cache tag in the root layout.
  revalidateTag(SITE_POPUPS_CACHE_TAG, "max");
}

/**
 * FormData → renderer-shaped fields. Pairing rules (a secondary CTA or
 * featured value needs both of its parts) get explicit messages here; field
 * content is validated by the popups service.
 */
function fieldsFromForm(
  formData: FormData,
): { value: PopupTemplateFields } | { error: PopupActionState } {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const optional = (name: string) => text(name) || null;

  const secondaryLabel = optional("secondaryCtaLabel");
  const secondaryHref = optional("secondaryCtaHref");
  if (Boolean(secondaryLabel) !== Boolean(secondaryHref)) {
    return {
      error: {
        status: "error",
        message: "The secondary button needs both a label and a link.",
      },
    };
  }

  const featuredLabel = optional("featuredValueLabel");
  const featuredValue = optional("featuredValueValue");
  if (Boolean(featuredLabel) !== Boolean(featuredValue)) {
    return {
      error: {
        status: "error",
        message: "The featured value card needs both a label and a value.",
      },
    };
  }

  const thresholdRaw = text("triggerThreshold");
  const threshold = thresholdRaw === "" ? null : Number(thresholdRaw);
  if (threshold !== null && !Number.isFinite(threshold)) {
    return {
      error: {
        status: "error",
        message: "Trigger threshold must be a number.",
      },
    };
  }

  return {
    value: {
      trigger: text("trigger") as PopupTemplateFields["trigger"],
      triggerThreshold: threshold,
      targetUrlPatterns: text("targetUrlPatterns")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      frequency: text("frequency") as PopupTemplateFields["frequency"],
      eyebrow: optional("eyebrow"),
      headline: text("headline"),
      body: text("body"),
      primaryCta: {
        label: text("primaryCtaLabel"),
        href: text("primaryCtaHref"),
      },
      secondaryCta:
        secondaryLabel && secondaryHref
          ? { label: secondaryLabel, href: secondaryHref }
          : null,
      featuredValue:
        featuredLabel && featuredValue
          ? {
              label: featuredLabel,
              value: featuredValue,
              note: optional("featuredValueNote"),
            }
          : null,
      offerCode: optional("offerCode"),
      dismissText: optional("dismissText"),
      accentColor: optional("accentColor"),
    },
  };
}

function validationError(error: z.ZodError): PopupActionState {
  return { status: "error", message: error.issues[0]!.message };
}

function actionError(error: unknown, fallback: string): PopupActionState {
  if (error instanceof PopupServiceError) {
    return { status: "error", message: error.message };
  }
  console.error("popup admin action failed", error);
  return { status: "error", message: fallback };
}
