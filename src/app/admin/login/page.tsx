import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ADMIN_AFTER_LOGIN_PATH,
  authErrorMessage,
  normalizeAdminEmailParam,
  normalizeAdminNextPath,
} from "@/lib/supabase/auth-redirects";
import { isDevAdminAuthBypassEnabled } from "@/lib/supabase/dev-auth";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";
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
    <AdminAuthCard title="Sign in">
      <LoginForm
        defaultEmail={defaultEmail}
        guestEnabled={Boolean(process.env.ADMIN_GUEST_EMAIL?.trim())}
        initialError={authErrorMessage(params.error)}
        nextPath={nextPath}
      />
    </AdminAuthCard>
  );
}
