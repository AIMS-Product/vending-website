"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_AFTER_LOGIN_PATH } from "@/lib/supabase/auth-redirects";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string };

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password needs at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = updatePasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid password fields.",
    };
  }

  const supabase = await createClient();
  const ctx = await getAuthorizedAdmin({ serverClient: supabase });
  if (!ctx) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "This account no longer has admin access.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("admin password update failed", {
      userId: ctx.user.id,
      error,
    });
    return {
      status: "error",
      message: "Could not update password. Try another password.",
    };
  }

  redirect(ADMIN_AFTER_LOGIN_PATH);
}
