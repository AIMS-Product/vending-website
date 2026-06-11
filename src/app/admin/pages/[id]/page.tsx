import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { SeoPageEditorForm } from "@/components/admin/SeoPageEditorForm";
import { SeoPageCommentsPanel } from "@/components/admin/SeoPageCommentsPanel";
import { SeoPageRevisionPanel } from "@/components/admin/SeoPageRevisionPanel";
import { adminListAiPageProposals } from "@/lib/services/ai-page-proposals";
import { toEditorMediaAsset } from "@/lib/media/editor-asset";
import { adminListMediaAssets } from "@/lib/services/media-assets";
import {
  adminGetSeoPageById,
  adminListPageComments,
  adminListSeoPagePreviewTokens,
  adminListSeoPageRevisions,
} from "@/lib/services/seo-pages";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";
import { routePrefixOptionsFrom } from "@/lib/page-builder/page-paths";
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
  const [{ user, role }, { id }, query] = await Promise.all([
    requireAdmin(),
    params,
    searchParams,
  ]);
  const [
    page,
    revisions,
    previewTokens,
    internalLinkTargets,
    aiProposals,
    mediaAssets,
    comments,
    routePrefixes,
  ] = await Promise.all([
    adminGetSeoPageById(id),
    adminListSeoPageRevisions(id),
    adminListSeoPagePreviewTokens(id),
    adminListInternalLinkTargets({ currentPageId: id }),
    adminListAiPageProposals(id),
    adminListMediaAssets(),
    adminListPageComments(id),
    listRoutePrefixes(),
  ]);
  if (!page) notFound();

  return (
    <AdminShell
      activeSection="pages"
      eyebrow="SEO Page Builder"
      title="Edit SEO page"
      description="Update the page contract, page content, publishing state, previews, and revisions."
      userEmail={user.email}
      userRole={role}
      immersive
    >
      <SeoPageEditorForm
        page={page}
        internalLinkTargets={internalLinkTargets}
        mediaAssets={mediaAssets.map(toEditorMediaAsset)}
        aiProposals={aiProposals}
        savedFromRedirect={query.saved === "1"}
        redirectError={pageActionErrorMessage(query.error)}
        routePrefixOptions={routePrefixOptionsFrom(routePrefixes)}
      />
      <SeoPageRevisionPanel
        pageId={page.id}
        publishedRevisionId={page.published_revision_id}
        revisions={revisions}
        previewTokens={previewTokens}
      />
      <SeoPageCommentsPanel
        pageId={page.id}
        comments={comments}
        commentError={commentActionErrorMessage(query.error)}
      />
    </AdminShell>
  );
}

function pageActionErrorMessage(code: string | undefined) {
  if (code === "preview-revoke") {
    return "Could not revoke the preview link. Please try again.";
  }
  if (code === "rollback") {
    return "Could not restore that revision as a draft. Please try again.";
  }
  return undefined;
}

function commentActionErrorMessage(code: string | undefined) {
  if (code === "comment") {
    return "Could not add the comment. Please try again.";
  }
  return undefined;
}
