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
  pageId?: string;
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

const SOURCE_PATH_HINT = "Start the path with /, e.g. /resources/old-page";
const DESTINATION_PATH_HINT =
  "Start the path with /, e.g. /blog/new-page, or paste a full https:// link";

// Mirrors the service's isRootRelativePath floor (seo-pages.ts): a value the
// service will accept always begins with "/". Stricter checks (builder-route
// shape for sources, self-redirect, backslash escapes) stay in the service so
// its specific messages still surface — this only catches the common "foo"
// typo before it hits the service's jargon error.
function isRootRelativeLike(value: string) {
  return value.startsWith("/");
}

// The service accepts an http(s) URL as a redirect destination, so the form
// must not reject one as "missing the leading slash".
function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const createSchema = z.object({
  sourcePath: z
    .string()
    .trim()
    .min(1, SOURCE_PATH_HINT)
    .refine(isRootRelativeLike, SOURCE_PATH_HINT),
  destinationPath: z
    .string()
    .trim()
    .min(1, "Add where this path should send people, e.g. /blog/new-page")
    .refine(
      (value) => isRootRelativeLike(value) || isHttpUrl(value),
      DESTINATION_PATH_HINT,
    ),
  statusCode: z.coerce
    .number()
    .refine((value) => REDIRECT_STATUS_CODES.includes(value as 301), {
      message: "Choose a supported redirect status.",
    }),
  // Optional page association: blank means "no page", anything else must be a
  // real UUID so junk never reaches the redirects table's page_id column.
  // Shaped as transform→pipe because Zod 4's preprocess rejects an absent key
  // ("expected nonoptional") even when the inner schema is optional.
  pageId: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed === "" ? undefined : trimmed;
    })
    .pipe(z.uuid("Enter a valid page ID or leave blank.").optional()),
});

const updateSchema = createSchema.extend({
  id: z.uuid("Choose which redirect to update."),
});

const deleteSchema = z.object({
  id: z.uuid("Choose which redirect to delete."),
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
    else if (key === "pageId") fieldErrors.pageId = issue.message;
  }
  return {
    status: "error",
    message: error.issues[0]?.message ?? "Redirect is invalid.",
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    values,
  };
}
