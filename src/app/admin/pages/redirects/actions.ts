"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminCreateBuilderRedirect,
  adminDeleteBuilderRedirect,
  adminUpdateBuilderRedirect,
  SeoPageValidationError,
} from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";

export type RedirectFieldErrors = {
  sourcePath?: string;
  destinationPath?: string;
  statusCode?: string;
};

// The raw strings the admin submitted, echoed back so the form can re-render
// them as defaults. Without this, a useActionState re-render after a failed
// submit blanks the uncontrolled inputs and the admin retypes from scratch.
export type RedirectValues = {
  sourcePath: string;
  destinationPath: string;
  statusCode: string;
};

export type RedirectFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: RedirectFieldErrors;
      values?: RedirectValues;
    };

const REDIRECT_STATUS_CODES = [301, 302, 307, 308] as const;

const REDIRECTS_PATH = "/admin/pages/redirects";

const createSchema = z.object({
  sourcePath: z
    .string()
    .trim()
    .min(1, "Start the path with /, e.g. /resources/old-page"),
  destinationPath: z
    .string()
    .trim()
    .min(1, "Add where this path should send people, e.g. /blog/new-page"),
  statusCode: z.coerce
    .number()
    .refine((value) => REDIRECT_STATUS_CODES.includes(value as 301), {
      message: "Choose a supported redirect status.",
    }),
  pageId: z.string().trim().optional(),
});

const updateSchema = createSchema.extend({
  id: z.string().trim().min(1, "Choose which redirect to update."),
});

const deleteSchema = z.object({
  id: z.string().trim().min(1, "Choose which redirect to delete."),
});

// Maps a service-layer validation issue path onto the form field the admin
// edited, so the inline message lands under the right input.
function fieldErrorsFromIssues(
  error: SeoPageValidationError,
): RedirectFieldErrors {
  const fieldErrors: RedirectFieldErrors = {};
  for (const issue of error.issues) {
    if (issue.path === "source_path" || issue.path === "path") {
      fieldErrors.sourcePath = issue.message;
    } else if (issue.path === "destination_path") {
      fieldErrors.destinationPath = issue.message;
    } else if (issue.path === "status_code") {
      fieldErrors.statusCode = issue.message;
    }
  }
  return fieldErrors;
}

function valuesFromForm(formData: FormData): RedirectValues {
  return {
    sourcePath: String(formData.get("sourcePath") ?? ""),
    destinationPath: String(formData.get("destinationPath") ?? ""),
    statusCode: String(formData.get("statusCode") ?? "301"),
  };
}

function validationErrorState(
  error: SeoPageValidationError,
  values: RedirectValues,
): RedirectFormState {
  const fieldErrors = fieldErrorsFromIssues(error);
  return {
    status: "error",
    message: error.issues[0]?.message ?? "Redirect is invalid.",
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    values,
  };
}

export async function createBuilderRedirectAction(
  _prev: RedirectFormState,
  formData: FormData,
): Promise<RedirectFormState> {
  const admin = await requireAdmin();

  const parsed = createSchema.safeParse({
    sourcePath: formData.get("sourcePath") ?? "",
    destinationPath: formData.get("destinationPath") ?? "",
    statusCode: formData.get("statusCode") ?? "301",
    pageId: formData.get("pageId") ?? "",
  });
  const values = valuesFromForm(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error, values);
  }

  try {
    await adminCreateBuilderRedirect({
      sourcePath: parsed.data.sourcePath,
      destinationPath: parsed.data.destinationPath,
      statusCode: parsed.data.statusCode,
      pageId: parsed.data.pageId || null,
      createdBy: admin.user.id,
      createdReason: "manual",
    });
  } catch (error) {
    if (error instanceof SeoPageValidationError) {
      return validationErrorState(error, values);
    }
    console.error("createBuilderRedirectAction failed", error);
    return { status: "error", message: "Could not create redirect." };
  }

  revalidatePath(REDIRECTS_PATH);
  redirect(`${REDIRECTS_PATH}?created=1`);
}

export async function updateBuilderRedirectAction(
  _prev: RedirectFormState,
  formData: FormData,
): Promise<RedirectFormState> {
  await requireAdmin();

  const parsed = updateSchema.safeParse({
    id: formData.get("id") ?? "",
    sourcePath: formData.get("sourcePath") ?? "",
    destinationPath: formData.get("destinationPath") ?? "",
    statusCode: formData.get("statusCode") ?? "301",
  });
  const values = valuesFromForm(formData);
  if (!parsed.success) {
    return zodErrorState(parsed.error, values);
  }

  try {
    await adminUpdateBuilderRedirect({
      id: parsed.data.id,
      sourcePath: parsed.data.sourcePath,
      destinationPath: parsed.data.destinationPath,
      statusCode: parsed.data.statusCode,
    });
  } catch (error) {
    if (error instanceof SeoPageValidationError) {
      return validationErrorState(error, values);
    }
    console.error("updateBuilderRedirectAction failed", error);
    return { status: "error", message: "Could not update redirect." };
  }

  revalidatePath(REDIRECTS_PATH);
  redirect(`${REDIRECTS_PATH}?updated=1`);
}

export async function deleteBuilderRedirectAction(
  _prev: RedirectFormState,
  formData: FormData,
): Promise<RedirectFormState> {
  await requireAdmin();

  const parsed = deleteSchema.safeParse({ id: formData.get("id") ?? "" });
  if (!parsed.success) {
    return zodErrorState(parsed.error);
  }

  try {
    await adminDeleteBuilderRedirect(parsed.data.id);
  } catch (error) {
    if (error instanceof SeoPageValidationError) {
      return {
        status: "error",
        message: error.issues[0]?.message ?? "Could not delete redirect.",
      };
    }
    console.error("deleteBuilderRedirectAction failed", error);
    return { status: "error", message: "Could not delete redirect." };
  }

  revalidatePath(REDIRECTS_PATH);
  redirect(`${REDIRECTS_PATH}?deleted=1`);
}

function zodErrorState(
  error: z.ZodError,
  values?: RedirectValues,
): RedirectFormState {
  const fieldErrors: RedirectFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "sourcePath") fieldErrors.sourcePath = issue.message;
    else if (key === "destinationPath")
      fieldErrors.destinationPath = issue.message;
    else if (key === "statusCode") fieldErrors.statusCode = issue.message;
  }
  return {
    status: "error",
    message: error.issues[0]?.message ?? "Redirect is invalid.",
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    values,
  };
}
