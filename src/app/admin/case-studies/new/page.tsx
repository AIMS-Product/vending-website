import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { CaseStudyEditorForm } from "@/components/admin/CaseStudyEditorForm";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "New case study",
  robots: { index: false, follow: false },
};

export default async function NewCaseStudyPage() {
  const { user, role } = await requireAdmin();

  return (
    <AdminShell
      activeSection="caseStudies"
      eyebrow="Case studies CMS"
      title="New case study"
      description="Create a member video story from the shared CMS backend."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/case-studies" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="crown" />
          </span>
          Case studies
        </Link>
      }
    >
      <CaseStudyEditorForm />
    </AdminShell>
  );
}
