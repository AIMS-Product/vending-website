"use server";

import { revalidatePath } from "next/cache";
import {
  adminCreateRoutePrefix,
  adminDeleteRoutePrefix,
  RoutePrefixServiceError,
} from "@/lib/services/route-prefixes";
import {
  AdminAuthorizationError,
  requireSuperAdmin,
} from "@/lib/supabase/auth";

export type RouteSettingsActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const ADMIN_SETTINGS_ROUTES_PATH = "/admin/settings/routes";

export async function addRoutePrefix(
  _prev: RouteSettingsActionState,
  formData: FormData,
): Promise<RouteSettingsActionState> {
  try {
    await requireSuperAdmin();
    await adminCreateRoutePrefix({
      prefix: String(formData.get("prefix") ?? ""),
      label: String(formData.get("label") ?? ""),
    });
    revalidatePath(ADMIN_SETTINGS_ROUTES_PATH);
    return { status: "saved", message: "Route prefix added." };
  } catch (error) {
    return actionError(error, "Could not add route prefix.");
  }
}

export async function removeRoutePrefix(
  _prev: RouteSettingsActionState,
  formData: FormData,
): Promise<RouteSettingsActionState> {
  try {
    await requireSuperAdmin();
    await adminDeleteRoutePrefix({
      prefix: String(formData.get("prefix") ?? ""),
    });
    revalidatePath(ADMIN_SETTINGS_ROUTES_PATH);
    return { status: "saved", message: "Route prefix deleted." };
  } catch (error) {
    return actionError(error, "Could not delete route prefix.");
  }
}

function actionError(
  error: unknown,
  fallback: string,
): RouteSettingsActionState {
  if (error instanceof AdminAuthorizationError) {
    return {
      status: "error",
      message: "Only super admins can manage route prefixes.",
    };
  }
  if (error instanceof RoutePrefixServiceError) {
    return { status: "error", message: error.message };
  }

  console.error("settings route prefix action failed", error);
  return {
    status: "error",
    message: fallback,
  };
}
