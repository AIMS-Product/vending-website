import type { Metadata } from "next";
import {
  authErrorMessage,
  normalizeAdminEmailParam,
} from "@/lib/supabase/auth-redirects";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset admin password",
  robots: { index: false, follow: false },
};

type SearchParams = { email?: string; error?: string };

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const defaultEmail = normalizeAdminEmailParam(params.email);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-ui-accent flex size-10 items-center justify-center rounded-md text-lg font-semibold text-white shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-ui-text text-xl font-semibold">
              Reset password
            </h1>
            <p className="text-ui-text-subtle text-sm">Admin CMS</p>
          </div>
        </div>
        <p className="text-ui-text-muted pt-2 text-sm leading-6">
          Enter your Studio email. If it has admin access, we&apos;ll send a
          password reset link.
        </p>
      </header>

      <div className="border-ui-line rounded-lg border bg-white p-6 shadow-sm">
        <ForgotPasswordForm
          defaultEmail={defaultEmail}
          initialError={authErrorMessage(params.error)}
        />
      </div>
    </section>
  );
}
