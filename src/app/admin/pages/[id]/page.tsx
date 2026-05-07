import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SeoPageEditorForm,
  type SeoPageEditorMediaAsset,
} from "@/components/admin/SeoPageEditorForm";
import { SeoPageRevisionPanel } from "@/components/admin/SeoPageRevisionPanel";
import { adminListAiPageProposals } from "@/lib/services/ai-page-proposals";
import {
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "@/lib/services/media-assets";
import {
  adminGetSeoPageById,
  adminListSeoPagePreviewTokens,
  adminListSeoPageRevisions,
} from "@/lib/services/seo-pages";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = { id: string };
type SearchParams = { saved?: string; error?: string };

export const metadata: Metadata = {
  title: "Edit SEO page",
  robots: { index: false, follow: false },
};

export default async function EditSeoPagePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [
    page,
    revisions,
    previewTokens,
    internalLinkTargets,
    aiProposals,
    mediaAssets,
  ] = await Promise.all([
    adminGetSeoPageById(id),
    adminListSeoPageRevisions(id),
    adminListSeoPagePreviewTokens(id),
    adminListInternalLinkTargets({ currentPageId: id }),
    adminListAiPageProposals(id),
    adminListMediaAssets(),
  ]);
  if (!page) notFound();

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
      <div className="mb-8">
        <p className="text-brand-500 text-sm font-medium">SEO Page Builder</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Edit resource page
        </h1>
      </div>
      <SeoPageEditorForm
        page={page}
        internalLinkTargets={internalLinkTargets}
        mediaAssets={mediaAssets.map(toEditorMediaAsset)}
        aiProposals={aiProposals}
        savedFromRedirect={query.saved === "1"}
        redirectError={pageActionErrorMessage(query.error)}
      />
      <SeoPageRevisionPanel
        pageId={page.id}
        revisions={revisions}
        previewTokens={previewTokens}
      />
    </section>
  );
}

function toEditorMediaAsset(
  asset: Awaited<ReturnType<typeof adminListMediaAssets>>[number],
): SeoPageEditorMediaAsset {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.alt_text ?? "",
    caption: asset.caption,
    sourceRightsNotes: asset.source_rights_notes ?? "",
    publicUrl: publicMediaAssetUrl(asset),
  };
}

function pageActionErrorMessage(code: string | undefined) {
  if (code === "preview-revoke") {
    return "Could not revoke the preview link. Please try again.";
  }
  if (code === "rollback") {
    return "Could not roll back to that revision. Please try again.";
  }
  return undefined;
}
