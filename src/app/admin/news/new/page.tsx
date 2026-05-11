import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { requireAdmin } from "@/lib/supabase/auth";
import { NewsEditorForm } from "@/components/admin/NewsEditorForm";

export const metadata: Metadata = {
  title: "New post",
  robots: { index: false, follow: false },
};

export default async function NewPostPage() {
  const { user, role } = await requireAdmin();

  return (
    <AdminShell
      activeSection="posts"
      eyebrow="Blog CMS"
      title="New blog post"
      description="Create an article or announcement from the shared CMS backend."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/news" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="newspaper" />
            </span>
            Blog and news
          </Link>
          <Link href="/admin/pages" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="file" />
            </span>
            Resource pages
          </Link>
        </>
      }
    >
      <NewsEditorForm />
    </AdminShell>
  );
}
