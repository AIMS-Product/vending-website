import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourcePageRenderer } from "@/components/sections/ResourcePageRenderer";
import { seoPageDraftContentSchema } from "@/lib/services/seo-pages";
import {
  adminGetSeoPageById,
  adminGetSeoPageRevision,
} from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Json } from "@/types/database";

type Params = { id: string; revisionId: string };

export const metadata: Metadata = {
  title: "SEO page revision preview",
  robots: { index: false, follow: false },
};

export default async function AdminRevisionPreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireAdmin();
  const { id, revisionId } = await params;
  const [page, revision] = await Promise.all([
    adminGetSeoPageById(id),
    adminGetSeoPageRevision(id, revisionId),
  ]);
  if (!page || !revision) notFound();

  const content = seoPageDraftContentSchema.safeParse(
    revision.content_snapshot,
  );
  if (!content.success) notFound();

  const snapshot = readSeoSnapshot(revision.seo_snapshot);
  const previewPage = {
    ...page,
    title: snapshot.title ?? page.title,
    target_keyword: snapshot.target_keyword ?? page.target_keyword,
    seo_title: snapshot.seo_title ?? page.seo_title,
    meta_description: snapshot.meta_description ?? page.meta_description,
    canonical_url: snapshot.canonical_url ?? page.canonical_url,
    noindex: true,
    sitemap_enabled: false,
    published_content: content.data,
  };

  return (
    <main>
      <div className="border-b border-slate-200 bg-slate-950 px-6 py-4 text-white lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Revision preview</p>
            <p className="mt-1 text-xs text-slate-300">
              {revision.revision_type} - {formatDateTime(revision.created_at)}
            </p>
          </div>
          <Link
            href={`/admin/pages/${page.id}`}
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          >
            Back to editor
          </Link>
        </div>
      </div>
      <ResourcePageRenderer page={previewPage} />
    </main>
  );
}

function readSeoSnapshot(snapshot: Json) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }
  const values = snapshot as Record<string, Json | undefined>;
  return {
    title: typeof values.title === "string" ? values.title : undefined,
    target_keyword:
      typeof values.target_keyword === "string"
        ? values.target_keyword
        : undefined,
    seo_title:
      typeof values.seo_title === "string" ? values.seo_title : undefined,
    meta_description:
      typeof values.meta_description === "string"
        ? values.meta_description
        : undefined,
    canonical_url:
      typeof values.canonical_url === "string"
        ? values.canonical_url
        : undefined,
  };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
