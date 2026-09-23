import type { Metadata } from "next";
import {
  authErrorMessage,
  normalizeAdminEmailParam,
} from "@/lib/supabase/auth-redirects";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";
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
    <AdminAuthCard
      title="Reset password"
      description={
        <>
          Enter your Studio email. If it has admin access, we&apos;ll send a
          password reset link.
        </>
      }
    >
      <ForgotPasswordForm
        defaultEmail={defaultEmail}
        initialError={authErrorMessage(params.error)}
      />
    </AdminAuthCard>
  );
}
