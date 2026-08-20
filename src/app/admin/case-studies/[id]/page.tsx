import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { CaseStudyEditorForm } from "@/components/admin/CaseStudyEditorForm";
import { adminGetCaseStudyById } from "@/lib/services/case-studies";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = { id: string };
type SearchParams = { saved?: string };

export const metadata: Metadata = {
  title: "Edit case study",
  robots: { index: false, follow: false },
};

export default async function EditCaseStudyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, { id }, query] = await Promise.all([
    requireAdmin(),
    params,
    searchParams,
  ]);
  const caseStudy = await adminGetCaseStudyById(id);
  if (!caseStudy) notFound();

  return (
    <AdminShell
      activeSection="caseStudies"
      eyebrow="Case studies CMS"
      title="Edit case study"
      description="Update the story, video, quote, and result figures."
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
      <CaseStudyEditorForm
        caseStudy={caseStudy}
        savedFromRedirect={query.saved === "1"}
      />
    </AdminShell>
  );
}
