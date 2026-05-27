import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import {
  MediaLibraryManager,
  type MediaAssetListItem,
} from "@/components/admin/MediaLibraryManager";
import {
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "@/lib/services/media-assets";
import { requireAdmin } from "@/lib/supabase/auth";

type SearchParams = { q?: string | string[] };

export const metadata: Metadata = {
  title: "Media library admin",
  robots: { index: false, follow: false },
};

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const searchQuery = normalizeSearch(firstParam(params.q));
  const [allAssets, assets] = await Promise.all([
    adminListMediaAssets(),
    adminListMediaAssets({ search: searchQuery }),
  ]);
  const assetCounts = countAssets(allAssets);

  return (
    <AdminShell
      activeSection="media"
      eyebrow="CMS Assets"
      title="Media library"
      description="Keep image and source assets available for resource pages, blog posts, landing pages, and future campaign content."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/libraries" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="layers" />
            </span>
            Content libraries
          </Link>
        </>
      }
    >
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="image"
          tone="blue"
          label="Total"
          value={allAssets.length}
          caption="all assets"
        />
        <AdminMetricPanel
          icon="upload"
          tone="green"
          label="Stored"
          value={assetCounts.stored}
          caption="uploaded"
        />
        <AdminMetricPanel
          icon="file"
          tone="slate"
          label="External"
          value={assetCounts.external}
          caption="linked"
        />
        <AdminMetricPanel
          icon="layers"
          tone="purple"
          label="Tagged"
          value={assetCounts.tagged}
          caption="organized"
        />
      </AdminMetricStrip>

      <div className="mb-7 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <form
          action="/admin/media"
          className="flex h-12 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm lg:w-96"
        >
          <span className="text-slate-500" aria-hidden="true">
            <AdminIcon icon="search" />
          </span>
          <label className="sr-only" htmlFor="admin-media-search">
            Search media assets
          </label>
          <input
            id="admin-media-search"
            name="q"
            aria-label="Search media assets"
            defaultValue={searchQuery}
            placeholder="Search title"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
        <p className="text-sm text-slate-600">
          Showing {assets.length} media{" "}
          {assets.length === 1 ? "asset" : "assets"}
        </p>
      </div>

      <MediaLibraryManager assets={assets.map(toListItem)} />
    </AdminShell>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearch(value: string | undefined) {
  return value?.trim().slice(0, 120) ?? "";
}

function countAssets(assets: Awaited<ReturnType<typeof adminListMediaAssets>>) {
  return assets.reduce(
    (counts, asset) => {
      if (asset.storage_path) counts.stored += 1;
      if (asset.external_url) counts.external += 1;
      if (asset.tags.length > 0) counts.tagged += 1;
      return counts;
    },
    { stored: 0, external: 0, tagged: 0 },
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
