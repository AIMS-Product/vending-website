import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set admin password",
  robots: { index: false, follow: false },
};

export default async function AdminResetPasswordPage() {
  await requireAdmin();

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-[#0b63f6] text-lg font-semibold text-white shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">
              Set password
            </h1>
            <p className="text-sm text-slate-500">Admin CMS</p>
          </div>
        </div>
        <p className="pt-2 text-sm leading-6 text-slate-600">
          Choose a new password for your Studio account.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ResetPasswordForm />
      </div>
    </section>
  );
}
