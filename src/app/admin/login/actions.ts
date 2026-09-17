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
  { status: "idle" } | { status: "error"; message: string; email: string };

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

/**
 * The shared read-only account behind "Continue as guest". Guests never type
 * or see this address: the form posts `guest=1` and the server fills the
 * email in, so the account is not sitting in the login page's HTML.
 *
 * Unset means no guest button works — deliberately. A typo'd env var must
 * fail closed rather than fall through to some other account.
 */
function guestEmail(): string {
  return (process.env.ADMIN_GUEST_EMAIL ?? "").trim().toLowerCase();
}

export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const nextPath = String(formData.get("next") ?? "");

  if (formData.get("guest") === "1") {
    const email = guestEmail();
    if (!email) {
      return {
        status: "error",
        message: "Guest access is not set up yet.",
        email: "",
      };
    }

    const password = String(formData.get("password") ?? "");
    if (!password) {
      return { status: "error", message: "Enter the password.", email: "" };
    }

    // Guests get no email back in the error state: there is no email field
    // to repopulate, and echoing the shared address would leak it.
    return signIn({ email, password, next: nextPath, echoEmail: "" });
  }

  const submittedEmail = normalizeAdminEmailParam(
    String(formData.get("email") ?? ""),
  );
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    next: nextPath,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid login fields.",
      email: submittedEmail,
    };
  }

  return signIn({
    email: parsed.data.email,
    password: parsed.data.password,
    next: parsed.data.next ?? "",
    echoEmail: parsed.data.email,
  });
}

/**
 * The one sign-in path. Guest and email logins both land here, so the
 * allowlist check and the sign-out-on-failure can never drift apart between
 * the two — a guest is authorised by exactly the checks an admin is.
 */
async function signIn({
  email,
  password,
  next,
  echoEmail,
}: {
  email: string;
  password: string;
  next: string;
  echoEmail: string;
}): Promise<LoginState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: "error",
      message: echoEmail
        ? "Email or password is incorrect."
        : "That password is incorrect.",
      email: echoEmail,
    };
  }

  const ctx = await getAuthorizedAdmin({ serverClient: supabase });
  if (!ctx) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message: echoEmail
        ? "This email does not have admin access."
        : "Guest access is not set up yet.",
      email: echoEmail,
    };
  }

  redirect(normalizeAdminNextPath(next));
}
