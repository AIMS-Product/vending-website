import type { Metadata } from "next";
import { authErrorMessage } from "@/lib/supabase/auth-redirects";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset admin password",
  robots: { index: false, follow: false },
};

type SearchParams = { error?: string };

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#0b63f6] text-lg font-semibold text-white shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">
              Reset password
            </h1>
            <p className="text-sm text-slate-500">Admin CMS</p>
          </div>
        </div>
        <p className="pt-2 text-sm leading-6 text-slate-600">
          Enter your Studio email. If it has admin access, we&apos;ll send a
          password reset link.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ForgotPasswordForm initialError={authErrorMessage(params.error)} />
      </div>
    </section>
  );
}
