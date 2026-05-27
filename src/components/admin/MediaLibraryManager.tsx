"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import {
  createMediaAsset,
  createSignedMediaUpload,
  deleteMediaAsset,
  fetchMediaAssetUsage,
  updateMediaAsset,
  type MediaAssetActionState,
} from "@/app/admin/media/actions";
import {
  AdminIcon,
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import type { MediaAssetUsage } from "@/lib/services/media-assets";
import { createClient } from "@/lib/supabase/client";

export type MediaAssetListItem = {
  id: string;
  assetType: "image" | "video" | "embed";
  title: string;
  alt_text: string | null;
  caption: string | null;
  source_rights_notes: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  duration_seconds: number | null;
  tags: string[];
  created_at: string;
  publicUrl: string;
};

type MediaLibraryManagerProps = {
  assets: MediaAssetListItem[];
};

const initialState: MediaAssetActionState = { status: "idle" };

export function MediaLibraryManager({ assets }: MediaLibraryManagerProps) {
  const [state, formAction] = useActionState(createMediaAsset, initialState);
  const [assetType, setAssetType] =
    useState<MediaAssetListItem["assetType"]>("image");
  const [externalUrl, setExternalUrl] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [editingAsset, setEditingAsset] = useState<MediaAssetListItem | null>(
    null,
  );
  const [usage, setUsage] = useState<MediaAssetUsage | null>(null);
  const [usageMessage, setUsageMessage] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleFileChange(file: File | null) {
    if (!file || assetType !== "image") return;
    setUploadMessage(null);
    startUploadTransition(async () => {
      try {
        const request = new FormData();
        request.set("filename", file.name);
        const signed = await createSignedMediaUpload(request);
        const supabase = createClient();
        const { error } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });
        if (error) throw error;
        setStorageBucket(signed.bucket);
        setStoragePath(signed.path);
        setExternalUrl("");
        setUploadMessage("Image uploaded.");
      } catch (error) {
        console.error("media upload failed", error);
        setUploadMessage("Could not upload the image.");
      }
    });
  }

  async function loadUsage(assetId: string) {
    setUsageMessage(null);
    try {
      const nextUsage = await fetchMediaAssetUsage(assetId);
      setUsage(nextUsage);
    } catch (error) {
      console.error("media usage lookup failed", error);
      setUsageMessage("Could not load asset usage.");
    }
  }

  function handleDelete(assetId: string) {
    startDeleteTransition(async () => {
      const result = await deleteMediaAsset(assetId);
      if (result.status === "error") {
        setUsageMessage(result.message);
        return;
      }
      setEditingAsset(null);
      setUsage(null);
      setUsageMessage("Media asset deleted.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form id="add-media" action={formAction} className={adminCardClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">Add media</h2>
          <span
            className="flex size-10 items-center justify-center rounded-md bg-[#e9f1ff] text-[#0b63f6]"
            aria-hidden="true"
          >
            <AdminIcon icon="upload" />
          </span>
        </div>
        {state.status !== "idle" && (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${
              state.status === "error"
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {state.message}
          </p>
        )}
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Type</span>
          <select
            name="assetType"
            aria-label="Asset type"
            value={assetType}
            onChange={(event) => {
              const next = event.target
                .value as MediaAssetListItem["assetType"];
              setAssetType(next);
              if (next !== "image") {
                setStorageBucket("");
                setStoragePath("");
              }
            }}
            className={adminInputClass}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="embed">Embed</option>
          </select>
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            name="title"
            aria-label="Title"
            required
            className={adminInputClass}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Alt text</span>
          <input
            name="altText"
            aria-label="Alt text"
            required={assetType === "image"}
            className={adminInputClass}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">
            Rights notes
          </span>
          <textarea
            name="sourceRightsNotes"
            aria-label="Rights notes"
            required
            rows={3}
            className={adminTextareaClass}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Caption</span>
          <input
            name="caption"
            aria-label="Caption"
            className={adminInputClass}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <input
            name="tags"
            aria-label="Tags"
            className={adminInputClass}
            placeholder="hero, proof"
          />
        </label>
        {assetType === "image" ? (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Upload</span>
            <input
              type="file"
              aria-label="Upload media"
              accept="image/avif,image/webp,image/png,image/jpeg"
              disabled={isUploading}
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? null)
              }
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#e9f1ff] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#0b63f6] hover:file:bg-[#dceaff]"
            />
          </label>
        ) : (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              Duration (seconds)
            </span>
            <input
              name="durationSeconds"
              aria-label="Duration seconds"
              className={adminInputClass}
            />
          </label>
        )}
        {uploadMessage && (
          <p className="mt-2 text-xs text-slate-500">{uploadMessage}</p>
        )}
        {storagePath && (
          <p className="mt-2 font-mono text-xs break-all text-slate-500">
            {storagePath}
          </p>
        )}
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">
            External URL
          </span>
          <input
            name="externalUrl"
            aria-label="External URL"
            value={externalUrl}
            onChange={(event) => {
              setExternalUrl(event.target.value);
              if (event.target.value) {
                setStorageBucket("");
                setStoragePath("");
              }
            }}
            className={adminInputClass}
          />
        </label>
        <input type="hidden" name="storageBucket" value={storageBucket} />
        <input type="hidden" name="storagePath" value={storagePath} />
        <button type="submit" className={`${adminPrimaryButtonClass} mt-5`}>
          Save media asset
        </button>
      </form>

      <section className={adminPanelClass}>
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Media assets
          </h2>
        </header>
        {usageMessage && (
          <p className="border-b border-slate-200 px-5 py-3 text-sm text-slate-600">
            {usageMessage}
          </p>
        )}
        {assets.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No media assets found.</p>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-[#bdd3ff] hover:shadow-sm"
              >
                {asset.publicUrl && asset.assetType === "image" ? (
                  <Image
                    src={asset.publicUrl}
                    alt={asset.alt_text ?? ""}
                    width={640}
                    height={360}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center bg-slate-50 px-4 text-center text-xs font-semibold text-slate-600 uppercase">
                    {asset.assetType} asset
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">
                        {asset.title}
                      </h3>
                      <p className="text-xs text-slate-500">{asset.alt_text}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
                      {asset.assetType}
                    </span>
                  </div>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.map((tag, index) => (
                        <span
                          key={`${tag}-${index}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className={adminSecondaryButtonClass}
                      onClick={() => {
                        setEditingAsset(asset);
                        setUsage(null);
                        void loadUsage(asset.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={adminSecondaryButtonClass}
                      disabled={isDeleting}
                      onClick={() => {
                        setEditingAsset(asset);
                        void loadUsage(asset.id);
                      }}
                    >
                      Usage
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editingAsset && (
        <AssetEditorModal
          asset={editingAsset}
          usage={usage}
          onClose={() => {
            setEditingAsset(null);
            setUsage(null);
          }}
          onDelete={() => handleDelete(editingAsset.id)}
        />
      )}
    </div>
  );
}

function AssetEditorModal({
  asset,
  usage,
  onClose,
  onDelete,
}: {
  asset: MediaAssetListItem;
  usage: MediaAssetUsage | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [state, formAction] = useActionState(updateMediaAsset, initialState);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-media-title"
        className="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Media asset
            </p>
            <h3
              id="edit-media-title"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              Edit {asset.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close edit media"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {state.status !== "idle" && (
            <p
              className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                state.status === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {state.message}
            </p>
          )}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="assetId" value={asset.id} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Title</span>
              <input
                name="title"
                defaultValue={asset.title}
                required
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Alt text
              </span>
              <input
                name="altText"
                defaultValue={asset.alt_text ?? ""}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Rights notes
              </span>
              <textarea
                name="sourceRightsNotes"
                defaultValue={asset.source_rights_notes ?? ""}
                rows={3}
                required
                className={adminTextareaClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Caption
              </span>
              <input
                name="caption"
                defaultValue={asset.caption ?? ""}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                External URL
              </span>
              <input
                name="externalUrl"
                defaultValue={asset.external_url ?? asset.publicUrl}
                className={adminInputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tags</span>
              <input
                name="tags"
                defaultValue={asset.tags.join(", ")}
                className={adminInputClass}
              />
            </label>
            {asset.assetType !== "image" ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Duration (seconds)
                </span>
                <input
                  name="durationSeconds"
                  defaultValue={asset.duration_seconds ?? ""}
                  className={adminInputClass}
                />
              </label>
            ) : null}
            <button type="submit" className={adminPrimaryButtonClass}>
              Save changes
            </button>
          </form>

          {usage && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Usage</h4>
              <p className="mt-1 text-xs text-slate-500">
                {usage.totalCount === 0
                  ? "This asset is not referenced anywhere."
                  : `${usage.totalCount} reference${usage.totalCount === 1 ? "" : "s"} found.`}
              </p>
              <UsageList title="Resource pages" items={usage.seoPages} />
              <UsageList title="News posts" items={usage.newsPosts} />
              <UsageList title="Proof items" items={usage.proofItems} />
              <UsageList
                title="Source documents"
                items={usage.sourceDocuments}
              />
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              className={`${adminSecondaryButtonClass} text-red-700`}
              disabled={Boolean(usage && usage.totalCount > 0)}
              onClick={onDelete}
            >
              Delete asset
            </button>
            {usage && usage.totalCount > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Remove references before deleting this asset.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function UsageList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title?: string; slug?: string; body?: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <ul className="mt-1 space-y-1 text-xs text-slate-600">
        {items.map((item) => (
          <li key={item.id}>
            {item.title ?? item.body ?? item.id}
            {item.slug ? ` (${item.slug})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

const adminPanelClass =
  "overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm";
