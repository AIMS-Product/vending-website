import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const post = await adminGetPostById(id);
  if (!post) notFound();

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
      <div className="mb-8">
        <p className="text-brand-500 text-sm font-medium">News CMS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Edit post
        </h1>
      </div>
      <NewsEditorForm post={post} savedFromRedirect={query.saved === "1"} />
    </section>
  );
}
