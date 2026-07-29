import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ADMIN_AFTER_LOGIN_PATH,
  authErrorMessage,
  normalizeAdminEmailParam,
  normalizeAdminNextPath,
} from "@/lib/supabase/auth-redirects";
import { isDevAdminAuthBypassEnabled } from "@/lib/supabase/dev-auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

type SearchParams = { email?: string; error?: string; next?: string };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (process.env.NODE_ENV === "development" && isDevAdminAuthBypassEnabled()) {
    redirect(ADMIN_AFTER_LOGIN_PATH);
  }

  const params = await searchParams;
  const nextPath = normalizeAdminNextPath(params.next);
  const defaultEmail = normalizeAdminEmailParam(params.email);

  return (
    <section
      data-admin-ui
      className="bg-ui-canvas flex min-h-screen w-full flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-sm">
        <header className="mb-5">
          <p className="text-ui-text-subtle text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
            Vendingpreneurs Studio
          </p>
          <h1 className="text-ui-text mt-1.5 text-[1.375rem] leading-7 font-semibold tracking-[-0.01em]">
            Sign in
          </h1>
        </header>

        <div className="rounded-ui-lg border-ui-line bg-ui-surface shadow-ui border p-5">
          <LoginForm
            defaultEmail={defaultEmail}
            initialError={authErrorMessage(params.error)}
            nextPath={nextPath}
          />
        </div>
      </div>
    </section>
  );
}
