import type { Metadata } from "next";
import Link from "next/link";
import {
  MediaLibraryManager,
  type MediaAssetListItem,
} from "@/components/admin/MediaLibraryManager";
import {
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "@/lib/services/media-assets";
import { requireAdmin } from "@/lib/supabase/auth";

type SearchParams = { q?: string };

export const metadata: Metadata = {
  title: "Media library admin",
  robots: { index: false, follow: false },
};

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const assets = await adminListMediaAssets({ search: q });

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-500 text-sm font-medium">SEO Page Builder</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Media library
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/pages"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Resource pages
          </Link>
        </div>
      </header>

      <form className="flex max-w-lg gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search titles"
          className="focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2"
        />
        <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          Search
        </button>
      </form>

      <MediaLibraryManager assets={assets.map(toListItem)} />
    </section>
  );
}

function toListItem(
  asset: Awaited<ReturnType<typeof adminListMediaAssets>>[number],
): MediaAssetListItem {
  return {
    id: asset.id,
    title: asset.title,
    alt_text: asset.alt_text,
    caption: asset.caption,
    source_rights_notes: asset.source_rights_notes,
    storage_bucket: asset.storage_bucket,
    storage_path: asset.storage_path,
    external_url: asset.external_url,
    tags: asset.tags,
    created_at: asset.created_at,
    publicUrl: publicMediaAssetUrl(asset),
  };
}
