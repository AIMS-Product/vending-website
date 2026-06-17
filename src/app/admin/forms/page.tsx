import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { QualificationFormsManager } from "@/components/admin/QualificationFormsManager";
import { adminListQualificationForms } from "@/lib/services/qualification-forms";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Qualification forms admin",
  robots: { index: false, follow: false },
};

export default async function AdminQualificationFormsPage() {
  const [{ user, role }, forms] = await Promise.all([
    requireAdmin(),
    adminListQualificationForms(),
  ]);

  return (
    <AdminShell
      activeSection="forms"
      eyebrow="Lead qualification"
      title="Qualification forms"
      description="Create and publish the post-submit question sets used after short lead forms."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/pages" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="file" />
          </span>
          SEO pages
        </Link>
      }
    >
      <QualificationFormsManager forms={forms} />
    </AdminShell>
  );
}
