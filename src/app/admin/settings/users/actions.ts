"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  changeAppUserRole,
  inviteAppUser,
  isStaleAdminRoleConstraintError,
  LastSuperAdminError,
  removeAppUserAccess,
  sendAppUserPasswordSetup,
} from "@/lib/services/app-users";
import {
  AdminAuthorizationError,
  requireSuperAdmin,
} from "@/lib/supabase/auth";

export type UserSettingsActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const ADMIN_SETTINGS_USERS_PATH = "/admin/settings/users";

const emailSchema = z.preprocess(
  (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase(),
  z.email("Enter a valid email address."),
);

const roleSchema = z.enum(["admin", "super_admin"], {
  error: "Choose a valid role.",
});

const inviteSchema = z.object({
  email: emailSchema,
  role: roleSchema,
});

const emailOnlySchema = z.object({
  email: emailSchema,
});

export async function inviteUser(
  _prev: UserSettingsActionState,
  formData: FormData,
): Promise<UserSettingsActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const actor = await requireSuperAdmin();
    await inviteAppUser(parsed.data, actor, {
      origin: await originFromHeaders(),
    });
    revalidatePath(ADMIN_SETTINGS_USERS_PATH);
    return { status: "saved", message: "User invited." };
  } catch (error) {
    return actionError(error, "Could not invite user.");
  }
}

export async function resendUserSetup(
  _prev: UserSettingsActionState,
  formData: FormData,
): Promise<UserSettingsActionState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const actor = await requireSuperAdmin();
    await sendAppUserPasswordSetup(parsed.data, actor, {
      origin: await originFromHeaders(),
    });
    revalidatePath(ADMIN_SETTINGS_USERS_PATH);
    return { status: "saved", message: "Password email sent." };
  } catch (error) {
    return actionError(error, "Could not send password email.");
  }
}

export async function changeUserRole(
  _prev: UserSettingsActionState,
  formData: FormData,
): Promise<UserSettingsActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const actor = await requireSuperAdmin();
    await changeAppUserRole(parsed.data, actor);
    revalidatePath(ADMIN_SETTINGS_USERS_PATH);
    return { status: "saved", message: "User role updated." };
  } catch (error) {
    return actionError(error, "Could not update user role.");
  }
}

export async function removeUserAccess(
  _prev: UserSettingsActionState,
  formData: FormData,
): Promise<UserSettingsActionState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const actor = await requireSuperAdmin();
    await removeAppUserAccess(parsed.data, actor);
    revalidatePath(ADMIN_SETTINGS_USERS_PATH);
    return { status: "saved", message: "User access removed." };
  } catch (error) {
    return actionError(error, "Could not remove user access.");
  }
}

function validationError(error: z.ZodError): UserSettingsActionState {
  return {
    status: "error",
    message: error.issues[0]?.message ?? "Invalid user settings fields.",
  };
}

function actionError(
  error: unknown,
  fallback: string,
): UserSettingsActionState {
  if (error instanceof AdminAuthorizationError) {
    return {
      status: "error",
      message: "Only super admins can manage users.",
    };
  }
  if (error instanceof LastSuperAdminError) {
    return {
      status: "error",
      message: "At least one super admin must remain.",
    };
  }
  if (isStaleAdminRoleConstraintError(error)) {
    return {
      status: "error",
      message:
        "The admin-role migration is pending. Apply migration 20260601100000 before assigning super admin access.",
    };
  }

  console.error("settings user action failed", error);
  return {
    status: "error",
    message: fallback,
  };
}

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("No host header on incoming request");
  return `${proto}://${host}`;
}
