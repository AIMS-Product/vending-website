import type { Metadata } from "next";
import { normalizeAdminEmailParam } from "@/lib/supabase/auth-redirects";
import { requireAdmin } from "@/lib/supabase/auth";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set admin password",
  robots: { index: false, follow: false },
};

type SearchParams = { email?: string };

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const defaultEmail =
    normalizeAdminEmailParam(params.email) ||
    normalizeAdminEmailParam(ctx.user.email);

  return (
    <AdminAuthCard
      title="Set password"
      description="Choose a new password for your Studio account."
    >
      <ResetPasswordForm email={defaultEmail} />
    </AdminAuthCard>
  );
}
