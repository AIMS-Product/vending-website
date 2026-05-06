import type { Metadata } from "next";
import { SeoPageEditorForm } from "@/components/admin/SeoPageEditorForm";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "New resource page",
  robots: { index: false, follow: false },
};

export default async function NewSeoPagePage() {
  await requireAdmin();
  const internalLinkTargets = await adminListInternalLinkTargets();

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
      <div className="mb-8">
        <p className="text-brand-500 text-sm font-medium">SEO Page Builder</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          New resource page
        </h1>
      </div>
      <SeoPageEditorForm internalLinkTargets={internalLinkTargets} />
    </section>
  );
}
