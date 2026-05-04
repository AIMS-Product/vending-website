import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/auth";
import { NewsEditorForm } from "@/components/admin/NewsEditorForm";

export const metadata: Metadata = {
  title: "New post",
  robots: { index: false, follow: false },
};

export default async function NewPostPage() {
  await requireAdmin();

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
      <div className="mb-8">
        <p className="text-brand-500 text-sm font-medium">News CMS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          New post
        </h1>
      </div>
      <NewsEditorForm />
    </section>
  );
}
