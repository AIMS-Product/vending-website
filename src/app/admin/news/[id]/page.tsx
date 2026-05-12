import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { NewsEditorForm } from "@/components/admin/NewsEditorForm";
import { adminGetPostById } from "@/lib/services/news";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = { id: string };
type SearchParams = { saved?: string };

export const metadata: Metadata = {
  title: "Edit post",
  robots: { index: false, follow: false },
};

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { user, role } = await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const post = await adminGetPostById(id);
  if (!post) notFound();

  return (
    <AdminShell
      activeSection="posts"
      eyebrow="Blog CMS"
      title="Edit blog post"
      description="Update article content, cover metadata, and publishing state."
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
      <NewsEditorForm post={post} savedFromRedirect={query.saved === "1"} />
    </AdminShell>
  );
}
