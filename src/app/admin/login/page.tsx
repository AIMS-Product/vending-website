import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ADMIN_AFTER_LOGIN_PATH,
  authErrorMessage,
} from "@/lib/supabase/auth-redirects";
import { isDevAdminAuthBypassEnabled } from "@/lib/supabase/dev-auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

type SearchParams = { error?: string };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (process.env.NODE_ENV === "development" && isDevAdminAuthBypassEnabled()) {
    redirect(ADMIN_AFTER_LOGIN_PATH);
  }

  const params = await searchParams;

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0b63f6] text-lg font-semibold text-white shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Studio</h1>
            <p className="text-sm text-slate-500">Admin CMS</p>
          </div>
        </div>
        <p className="pt-2 text-sm leading-6 text-slate-600">
          Enter the email on the allowlist. We&apos;ll send a one-time sign-in
          link — no passwords.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm initialError={authErrorMessage(params.error)} />
      </div>
    </section>
  );
}
