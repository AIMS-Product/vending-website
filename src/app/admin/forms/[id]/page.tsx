import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { QualificationFormEditor } from "@/components/admin/QualificationFormEditor";
import { adminGetQualificationForm } from "@/lib/services/qualification-forms";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = { id: string };

export const metadata: Metadata = {
  title: "Edit qualification form",
  robots: { index: false, follow: false },
};

export default async function EditQualificationFormPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [{ user, role }, { id }] = await Promise.all([requireAdmin(), params]);
  const form = await adminGetQualificationForm({ formId: id });
  if (!form) notFound();

  return (
    <AdminShell
      activeSection="forms"
      eyebrow="Lead qualification"
      title="Edit qualification form"
      description="Update draft questions, publish immutable versions, and choose the global fallback form."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/forms" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="list" />
            </span>
            Qualification forms
          </Link>
          <Link href="/admin/pages" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="file" />
            </span>
            SEO pages
          </Link>
        </>
      }
    >
      <QualificationFormEditor form={form} />
    </AdminShell>
  );
}
