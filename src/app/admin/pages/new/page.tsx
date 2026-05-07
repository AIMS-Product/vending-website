import type { Metadata } from "next";
import {
  SeoPageEditorForm,
  type SeoPageEditorMediaAsset,
} from "@/components/admin/SeoPageEditorForm";
import {
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "@/lib/services/media-assets";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "New resource page",
  robots: { index: false, follow: false },
};

export default async function NewSeoPagePage() {
  await requireAdmin();
  const [internalLinkTargets, mediaAssets] = await Promise.all([
    adminListInternalLinkTargets(),
    adminListMediaAssets(),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
      <div className="mb-8">
        <p className="text-brand-500 text-sm font-medium">SEO Page Builder</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          New resource page
        </h1>
      </div>
      <SeoPageEditorForm
        internalLinkTargets={internalLinkTargets}
        mediaAssets={mediaAssets.map(toEditorMediaAsset)}
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
    caption: asset.caption ?? "",
    sourceRightsNotes: asset.source_rights_notes ?? "",
    publicUrl: publicMediaAssetUrl(asset),
  };
}
