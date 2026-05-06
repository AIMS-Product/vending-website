import type { Metadata } from "next";
import { authErrorMessage } from "@/lib/supabase/auth-redirects";
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
  const params = await searchParams;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Vendingpreneurs admin
        </h1>
        <p className="text-sm text-slate-600">
          Enter the email on the allowlist. We&apos;ll send a one-time sign-in
          link — no passwords.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm initialError={authErrorMessage(params.error)} />
      </div>
    </section>
  );
}
