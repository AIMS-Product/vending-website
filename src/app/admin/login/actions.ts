"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  normalizeAdminEmailParam,
  normalizeAdminNextPath,
} from "@/lib/supabase/auth-redirects";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string; email: string };

const loginSchema = z.object({
  email: z.preprocess(
    (value) =>
      String(value ?? "")
        .trim()
        .toLowerCase(),
    z.email("Enter a valid email address."),
  ),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const submittedEmail = normalizeAdminEmailParam(
    String(formData.get("email") ?? ""),
  );
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid login fields.",
      email: submittedEmail,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "Email or password is incorrect.",
      email: parsed.data.email,
    };
  }

  const ctx = await getAuthorizedAdmin({ serverClient: supabase });
  if (!ctx) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "This email does not have admin access.",
      email: parsed.data.email,
    };
  }

  redirect(normalizeAdminNextPath(parsed.data.next));
}
