"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminCreateQualificationForm,
  adminSetDefaultQualificationForm,
  adminUpdateQualificationFormDraft,
  publishQualificationForm,
  QualificationFormServiceError,
} from "@/lib/services/qualification-forms";
import { requireAdmin } from "@/lib/supabase/auth";
import { attributableUserId } from "@/lib/supabase/dev-auth";

type QualificationFormActionError = {
  status: "error";
  message: string;
  /** Submitted values so a failed form can re-fill what the user typed. */
  values?: { name: string };
};

export type QualificationFormActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | QualificationFormActionError;

const ADMIN_FORMS_PATH = "/admin/forms";

const createFormSchema = z.object({
  name: z.string().trim().min(1, "Form name is required."),
});

const editorFormSchema = z.object({
  id: z.uuid("Invalid qualification form id."),
  name: z.string().trim().min(1, "Form name is required."),
  schema: z.string().trim().min(1, "Question draft is required."),
  intent: z.enum(["save", "publish"]).default("save"),
});

const idFormSchema = z.object({
  id: z.uuid("Invalid qualification form id."),
});

export async function createQualificationForm(
  _prev: QualificationFormActionState,
  formData: FormData,
): Promise<QualificationFormActionState> {
  const { user } = await requireAdmin();
  const typedName = String(formData.get("name") ?? "");
  const parsed = createFormSchema.safeParse({ name: typedName });

  if (!parsed.success) {
    return { ...validationError(parsed.error), values: { name: typedName } };
  }

  let redirectTo: string;
  try {
    const created = await adminCreateQualificationForm({
      name: parsed.data.name,
      createdBy: attributableUserId(user.id),
    });
    revalidatePath(ADMIN_FORMS_PATH);
    redirectTo = `${ADMIN_FORMS_PATH}/${created.id}`;
  } catch (error) {
    return {
      ...actionError(error, "Could not create qualification form."),
      values: { name: typedName },
    };
  }

  redirect(redirectTo);
}

export async function saveQualificationForm(
  _prev: QualificationFormActionState,
  formData: FormData,
): Promise<QualificationFormActionState> {
  const { user } = await requireAdmin();
  const parsed = editorFormSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    schema: formData.get("schema"),
    intent: formData.get("intent") ?? "save",
  });

  if (!parsed.success) return validationError(parsed.error);

  const schema = parseSchemaJson(parsed.data.schema);
  if (!schema.ok) return schema.error;

  try {
    await adminUpdateQualificationFormDraft({
      formId: parsed.data.id,
      name: parsed.data.name,
      schema: schema.value,
      updatedBy: attributableUserId(user.id),
    });

    if (parsed.data.intent === "publish") {
      const version = await publishQualificationForm({
        formId: parsed.data.id,
        publishedBy: attributableUserId(user.id),
      });
      revalidateFormPaths(parsed.data.id);
      return {
        status: "saved",
        message: `Published version ${version.versionNumber}.`,
      };
    }

    revalidateFormPaths(parsed.data.id);
    return {
      status: "saved",
      message: "Qualification form draft saved.",
    };
  } catch (error) {
    return actionError(error, "Could not save qualification form.");
  }
}

export async function setDefaultQualificationForm(
  _prev: QualificationFormActionState,
  formData: FormData,
): Promise<QualificationFormActionState> {
  const { user } = await requireAdmin();
  const parsed = idFormSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) return validationError(parsed.error);

  try {
    await adminSetDefaultQualificationForm({
      formId: parsed.data.id,
      updatedBy: attributableUserId(user.id),
    });
    revalidateFormPaths(parsed.data.id);
    return {
      status: "saved",
      message: "Default qualification form updated.",
    };
  } catch (error) {
    return actionError(error, "Could not update default qualification form.");
  }
}

function revalidateFormPaths(formId: string) {
  revalidatePath(ADMIN_FORMS_PATH);
  revalidatePath(`${ADMIN_FORMS_PATH}/${formId}`);
}

function parseSchemaJson(
  value: string,
):
  | { ok: true; value: unknown }
  | { ok: false; error: QualificationFormActionState } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return {
      ok: false,
      error: {
        status: "error",
        message: "Could not read the question draft. Refresh and try again.",
      },
    };
  }
}

function validationError(error: z.ZodError): QualificationFormActionError {
  return {
    status: "error",
    message: error.issues[0]!.message,
  };
}

function actionError(
  error: unknown,
  fallback: string,
): QualificationFormActionError {
  if (error instanceof QualificationFormServiceError) {
    return { status: "error", message: error.message };
  }

  console.error("qualification form admin action failed", error);
  return { status: "error", message: fallback };
}
