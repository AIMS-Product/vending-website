"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bulkAddMediaTags,
  bulkCreateMediaAssets,
  bulkDeleteMediaAssets,
  createMediaAsset,
  deleteMediaAsset,
  fetchMediaAssetUsage,
  updateMediaAsset,
  type MediaAssetActionState,
} from "@/app/admin/media/actions";
import {
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import {
  IMAGE_ACCEPT,
  defaultEditorImageFields,
  isAcceptedEditorImageFile,
  uploadImageFileToStorage,
} from "@/lib/media/editor-upload";
import type { MediaAssetUsage } from "@/lib/services/media-assets";

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
  usageCount: number;
};

type MediaLibraryManagerProps = {
  assets: MediaAssetListItem[];
  usageCounts?: Record<string, number>;
  view?: "grid" | "list";
};

const initialState: MediaAssetActionState = { status: "idle" };

export function MediaLibraryManager({
  assets,
  usageCounts = {},
  view = "grid",
}: MediaLibraryManagerProps) {
  const router = useRouter();
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [rawSelectedIds, setRawSelectedIds] = useState<string[]>([]);
  const [editingAsset, setEditingAsset] = useState<MediaAssetListItem | null>(
    null,
  );
  const [usageAsset, setUsageAsset] = useState<MediaAssetListItem | null>(null);
  const [usage, setUsage] = useState<MediaAssetUsage | null>(null);
  const [usageMessage, setUsageMessage] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isBulkWorking, startBulkTransition] = useTransition();

  const visibleIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const selectedIds = useMemo(
    () => rawSelectedIds.filter((id) => visibleIds.includes(id)),
    [rawSelectedIds, visibleIds],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedAssets = assets.filter((asset) =>
    selectedIds.includes(asset.id),
  );
  const selectedDeletableCount = selectedAssets.filter(
    (asset) => (usageCounts[asset.id] ?? asset.usageCount) === 0,
  ).length;

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
      setUsageAsset(null);
      setUsage(null);
      setRawSelectedIds((current) => current.filter((id) => id !== assetId));
      setUsageMessage("Media asset deleted.");
      router.refresh();
    });
  }

  function toggleSelected(assetId: string) {
    setRawSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  function toggleSelectAllVisible() {
    setRawSelectedIds(allVisibleSelected ? [] : visibleIds);
  }

  function runBulkDelete() {
    startBulkTransition(async () => {
      setBulkMessage(null);
      const result = await bulkDeleteMediaAssets(selectedIds);
      setBulkMessage(result.message);
      if (result.status === "saved") {
        setRawSelectedIds([]);
        router.refresh();
      }
    });
  }

  function runBulkTag(tag: string) {
    startBulkTransition(async () => {
      setBulkMessage(null);
      const result = await bulkAddMediaTags(selectedIds, tag);
      setBulkMessage(result.message);
      if (result.status === "saved") {
        setBulkTagOpen(false);
        setRawSelectedIds([]);
        router.refresh();
      }
    });
  }

  return (
    <>
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dceaff] bg-[#f4f8ff] px-5 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {selectedIds.length} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={isBulkWorking}
              onClick={() => setBulkTagOpen(true)}
            >
              Add tag
            </button>
            <button
              type="button"
              className={`${adminSecondaryButtonClass} text-red-700`}
              disabled={isBulkWorking || selectedDeletableCount === 0}
              onClick={runBulkDelete}
            >
              Delete unused
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => setRawSelectedIds([])}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {bulkMessage ? (
        <p className="border-b border-slate-200 px-5 py-3 text-sm text-slate-600">
          {bulkMessage}
        </p>
      ) : null}

      {assets.length > 0 ? (
        view === "list" ? (
          <MediaAssetTable
            assets={assets}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAll={toggleSelectAllVisible}
            onToggleSelected={toggleSelected}
            onEdit={(asset) => {
              setUsageAsset(null);
              setEditingAsset(asset);
            }}
            onUsage={(asset) => {
              setEditingAsset(null);
              setUsageAsset(asset);
              setUsage(null);
              void loadUsage(asset.id);
            }}
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <MediaAssetCard
                key={asset.id}
                asset={asset}
                selected={selectedIds.includes(asset.id)}
                onToggleSelected={() => toggleSelected(asset.id)}
                onEdit={() => {
                  setUsageAsset(null);
                  setEditingAsset(asset);
                }}
                onUsage={() => {
                  setEditingAsset(null);
                  setUsageAsset(asset);
                  setUsage(null);
                  void loadUsage(asset.id);
                }}
              />
            ))}
          </div>
        )
      ) : null}

      {usageMessage && assets.length > 0 ? (
        <p className="border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
          {usageMessage}
        </p>
      ) : null}

      {bulkTagOpen ? (
        <BulkTagModal
          count={selectedIds.length}
          disabled={isBulkWorking}
          onClose={() => setBulkTagOpen(false)}
          onSubmit={runBulkTag}
        />
      ) : null}

      {editingAsset ? (
        <AssetEditorModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onDelete={() => handleDelete(editingAsset.id)}
        />
      ) : null}

      {usageAsset ? (
        <AssetUsageModal
          asset={usageAsset}
          usage={usage}
          usageMessage={usageMessage}
          isDeleting={isDeleting}
          onClose={() => {
            setUsageAsset(null);
            setUsage(null);
            setUsageMessage(null);
          }}
          onDelete={() => handleDelete(usageAsset.id)}
        />
      ) : null}
    </>
  );
}

function MediaAssetCard({
  asset,
  selected,
  onToggleSelected,
  onEdit,
  onUsage,
}: {
  asset: MediaAssetListItem;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onUsage: () => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-md border bg-white transition hover:shadow-sm ${
        selected
          ? "border-[#0b63f6] ring-2 ring-[#0b63f6]/15"
          : "border-slate-200 hover:border-[#bdd3ff]"
      }`}
    >
      <div className="relative">
        {asset.publicUrl && asset.assetType === "image" ? (
          <Image
            src={asset.publicUrl}
            alt={asset.alt_text ?? ""}
            width={640}
            height={360}
            sizes="(max-width: 768px) 100vw, 25vw"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div className="grid aspect-[16/9] place-items-center bg-slate-50 px-4 text-center text-xs font-semibold text-slate-600 uppercase">
            {asset.assetType} asset
          </div>
        )}
        <label className="absolute top-3 left-3 inline-flex items-center rounded-md bg-white/95 px-2 py-1 shadow-sm">
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Select ${asset.title}`}
            onChange={onToggleSelected}
            className="size-4 rounded border-slate-300"
          />
        </label>
      </div>
      <div className="space-y-2 p-4">
        <AssetSummary asset={asset} />
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={onUsage}
          >
            Usage
          </button>
        </div>
      </div>
    </article>
  );
}

function MediaAssetTable({
  assets,
  selectedIds,
  allVisibleSelected,
  onToggleSelectAll,
  onToggleSelected,
  onEdit,
  onUsage,
}: {
  assets: MediaAssetListItem[];
  selectedIds: string[];
  allVisibleSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelected: (assetId: string) => void;
  onEdit: (asset: MediaAssetListItem) => void;
  onUsage: (asset: MediaAssetListItem) => void;
}) {
  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {assets.map((asset) => (
          <article
            key={asset.id}
            className={`rounded-md border bg-white p-4 ${
              selectedIds.includes(asset.id)
                ? "border-[#0b63f6] ring-2 ring-[#0b63f6]/15"
                : "border-slate-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(asset.id)}
                aria-label={`Select ${asset.title}`}
                onChange={() => onToggleSelected(asset.id)}
                className="mt-1 size-4 rounded border-slate-300"
              />
              <div className="min-w-0 flex-1">
                <AssetSummary asset={asset} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={adminSecondaryButtonClass}
                    onClick={() => onEdit(asset)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={adminSecondaryButtonClass}
                    onClick={() => onUsage(asset)}
                  >
                    Usage
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  aria-label="Select all visible assets"
                  onChange={onToggleSelectAll}
                  className="size-4 rounded border-slate-300"
                />
              </th>
              <th className="w-20 px-4 py-3">Preview</th>
              <th className="px-4 py-3">Title</th>
              <th className="w-24 px-4 py-3">Type</th>
              <th className="w-28 px-4 py-3">Source</th>
              <th className="w-28 px-4 py-3">Usage</th>
              <th className="px-4 py-3">Tags</th>
              <th className="w-32 px-4 py-3">Added</th>
              <th className="w-40 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className={
                  selectedIds.includes(asset.id) ? "bg-[#fbfdff]" : "bg-white"
                }
              >
                <td className="px-4 py-3 align-top">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(asset.id)}
                    aria-label={`Select ${asset.title}`}
                    onChange={() => onToggleSelected(asset.id)}
                    className="size-4 rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  {asset.publicUrl && asset.assetType === "image" ? (
                    <Image
                      src={asset.publicUrl}
                      alt=""
                      width={64}
                      height={40}
                      className="size-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="grid size-12 place-items-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase">
                      {asset.assetType}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-slate-950">{asset.title}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {asset.alt_text || "No alt text"}
                  </p>
                </td>
                <td className="px-4 py-3 align-top text-slate-700 capitalize">
                  {asset.assetType}
                </td>
                <td className="px-4 py-3 align-top">
                  <AssetSourceBadges asset={asset} />
                </td>
                <td className="px-4 py-3 align-top">
                  <UsageBadge count={asset.usageCount} />
                </td>
                <td className="px-4 py-3 align-top">
                  <AssetTagList tags={asset.tags} />
                </td>
                <td className="px-4 py-3 align-top text-slate-600">
                  {formatAssetDate(asset.created_at)}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={adminSecondaryButtonClass}
                      onClick={() => onEdit(asset)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={adminSecondaryButtonClass}
                      onClick={() => onUsage(asset)}
                    >
                      Usage
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AssetSummary({ asset }: { asset: MediaAssetListItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950">
            {asset.title}
          </h3>
          <p className="truncate text-xs text-slate-500">
            {asset.alt_text || "No alt text"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
          {asset.assetType}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <AssetSourceBadges asset={asset} />
        <UsageBadge count={asset.usageCount} />
        {!asset.alt_text?.trim() && asset.assetType === "image" ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Missing alt
          </span>
        ) : null}
      </div>
      <AssetTagList tags={asset.tags} />
    </>
  );
}

function AssetSourceBadges({ asset }: { asset: MediaAssetListItem }) {
  return (
    <>
      {asset.storage_path ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          Stored
        </span>
      ) : null}
      {asset.external_url ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          External
        </span>
      ) : null}
    </>
  );
}

function UsageBadge({ count }: { count: number }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        count > 0
          ? "bg-[#e9f1ff] text-[#0b63f6]"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {count > 0 ? `${count} in use` : "Unused"}
    </span>
  );
}

function AssetTagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <p className="text-xs text-slate-400">No tags</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function BulkTagModal({
  count,
  disabled,
  onClose,
  onSubmit,
}: {
  count: number;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (tag: string) => void;
}) {
  const [tag, setTag] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <ModalShell
      title="Add tag to selected assets"
      description={`Apply one tag to ${count} selected asset${count === 1 ? "" : "s"}.`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(tag);
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tag</span>
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            aria-label="Bulk tag"
            required
            className={adminInputClass}
            placeholder="hero, proof, news"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={disabled}
            className={adminPrimaryButtonClass}
          >
            Add tag
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

type BulkUploadItem = {
  file: File;
  title: string;
  altText: string;
  storageBucket: string;
  storagePath: string;
  status: "pending" | "uploading" | "ready" | "error";
  message?: string;
};

export function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<BulkUploadItem[]>([]);
  const [defaultTags, setDefaultTags] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isWorking, startWorkTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleDragState(event: DragEvent, dragging: boolean) {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(dragging);
  }

  function queueFiles(fileList: FileList | File[] | null) {
    const files = [...(fileList ?? [])].filter(isAcceptedEditorImageFile);
    if (files.length === 0) {
      setMessage("Use AVIF, WebP, PNG, or JPEG images only.");
      return;
    }
    if (files.length + items.length > 20) {
      setMessage("Upload up to 20 images at a time.");
      return;
    }
    setMessage(null);
    setItems((current) => [
      ...current,
      ...files.map((file) => {
        const defaults = defaultEditorImageFields(file);
        return {
          file,
          title: defaults.title,
          altText: defaults.altText,
          storageBucket: "",
          storagePath: "",
          status: "pending" as const,
        };
      }),
    ]);
  }

  function uploadItems() {
    startWorkTransition(async () => {
      setMessage(null);
      const nextItems = [...items];

      for (let index = 0; index < nextItems.length; index += 1) {
        const item = nextItems[index];
        if (item.status === "ready") continue;

        nextItems[index] = { ...item, status: "uploading" };
        setItems([...nextItems]);

        try {
          const uploaded = await uploadImageFileToStorage(item.file);
          nextItems[index] = {
            ...item,
            storageBucket: uploaded.storageBucket,
            storagePath: uploaded.storagePath,
            status: "ready",
          };
        } catch (error) {
          console.error("bulk media upload failed", error);
          nextItems[index] = {
            ...item,
            status: "error",
            message: "Upload failed.",
          };
        }
        setItems([...nextItems]);
      }

      const readyItems = nextItems.filter((item) => item.status === "ready");
      if (readyItems.length === 0) {
        setMessage("No images uploaded successfully.");
        return;
      }

      const result = await bulkCreateMediaAssets(
        readyItems.map((item) => ({
          title: item.title,
          altText: item.altText,
          storageBucket: item.storageBucket,
          storagePath: item.storagePath,
          tags: defaultTags,
        })),
      );

      setMessage(result.message);
      if (result.status === "saved") {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <ModalShell
      title="Bulk upload images"
      description="Upload multiple images with shared default tags. Titles and alt text come from filenames and can be edited before saving."
      onClose={onClose}
      wide
    >
      <div
        className={`rounded-lg border border-dashed p-4 text-center transition ${
          isDropActive
            ? "border-[#0b63f6] bg-[#f5fbff]"
            : "border-slate-200 bg-slate-50"
        }`}
        onDragEnter={(event) => handleDragState(event, true)}
        onDragOver={(event) => handleDragState(event, true)}
        onDragLeave={(event) => handleDragState(event, false)}
        onDrop={(event) => {
          handleDragState(event, false);
          queueFiles(event.dataTransfer.files);
        }}
      >
        <p className="text-sm font-semibold text-slate-700">Drop images here</p>
        <label className="mt-3 inline-flex cursor-pointer">
          <span className={adminSecondaryButtonClass}>Choose files</span>
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              queueFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">
          Default tags for all uploads
        </span>
        <input
          value={defaultTags}
          onChange={(event) => setDefaultTags(event.target.value)}
          aria-label="Default tags"
          className={adminInputClass}
          placeholder="hero, proof"
        />
      </label>

      {items.length > 0 ? (
        <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
          {items.map((item, index) => (
            <li
              key={`${item.file.name}-${index}`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">
                    Title
                  </span>
                  <input
                    value={item.title}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, title: event.target.value };
                      setItems(next);
                    }}
                    className={adminInputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">
                    Alt text
                  </span>
                  <input
                    value={item.altText}
                    onChange={(event) => {
                      const next = [...items];
                      next[index] = { ...item, altText: event.target.value };
                      setItems(next);
                    }}
                    className={adminInputClass}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {item.file.name}
                {item.status === "uploading" ? " · Uploading..." : ""}
                {item.status === "ready" ? " · Ready" : ""}
                {item.status === "error" ? ` · ${item.message}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-slate-600">{message}</p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={isWorking || items.length === 0}
          className={adminPrimaryButtonClass}
          onClick={uploadItems}
        >
          {isWorking ? "Uploading..." : "Upload and save"}
        </button>
        <button
          type="button"
          className={adminSecondaryButtonClass}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export function AddMediaModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(createMediaAsset, initialState);
  const [assetType, setAssetType] =
    useState<MediaAssetListItem["assetType"]>("image");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [isDropActive, setIsDropActive] = useState(false);

  useEffect(() => {
    if (state.status === "saved") onClose();
  }, [onClose, state.status]);

  function handleDragState(event: DragEvent, dragging: boolean) {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(dragging);
  }

  function applyUploadedFileDefaults(file: File) {
    const defaults = defaultEditorImageFields(file);
    setTitle((current) => (current.trim() ? current : defaults.title));
    setAltText((current) => (current.trim() ? current : defaults.altText));
  }

  function handleFileChange(file: File | null) {
    if (!file || assetType !== "image") return;
    if (!isAcceptedEditorImageFile(file)) {
      setUploadMessage("Use an AVIF, WebP, PNG, or JPEG image.");
      return;
    }
    applyUploadedFileDefaults(file);
    setUploadMessage(null);
    startUploadTransition(async () => {
      try {
        const uploaded = await uploadImageFileToStorage(file);
        setStorageBucket(uploaded.storageBucket);
        setStoragePath(uploaded.storagePath);
        setExternalUrl("");
        setUploadMessage("Image uploaded. Complete the form and save.");
      } catch (error) {
        console.error("media upload failed", error);
        setUploadMessage("Could not upload the image.");
      }
    });
  }

  return (
    <ModalShell title="Upload media" onClose={onClose}>
      <form id="add-media" action={formAction} className="space-y-4">
        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.message}
          </p>
        )}
        <label className="block">
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
        {assetType === "image" ? (
          <div
            className={`rounded-lg border border-dashed p-4 text-center transition ${
              isDropActive
                ? "border-[#0b63f6] bg-[#f5fbff]"
                : "border-slate-200 bg-slate-50"
            }`}
            onDragEnter={(event) => handleDragState(event, true)}
            onDragOver={(event) => handleDragState(event, true)}
            onDragLeave={(event) => handleDragState(event, false)}
            onDrop={(event) => {
              handleDragState(event, false);
              handleFileChange(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <p className="text-sm font-semibold text-slate-700">
              {isUploading ? "Uploading..." : "Drop an image here"}
            </p>
            <label className="mt-3 inline-flex cursor-pointer">
              <span className={adminSecondaryButtonClass}>Choose file</span>
              <input
                type="file"
                aria-label="Upload media"
                accept={IMAGE_ACCEPT}
                disabled={isUploading}
                className="sr-only"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
              />
            </label>
            {uploadMessage ? (
              <p className="mt-2 text-xs text-slate-500">{uploadMessage}</p>
            ) : null}
          </div>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            id="add-media-title"
            name="title"
            aria-label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Alt text</span>
          <input
            id="add-media-alt"
            name="altText"
            aria-label="Alt text"
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            required={assetType === "image"}
            className={adminInputClass}
          />
        </label>
        <label className="block">
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
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Caption</span>
          <input
            name="caption"
            aria-label="Caption"
            className={adminInputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <input
            name="tags"
            aria-label="Tags"
            className={adminInputClass}
            placeholder="hero, proof"
          />
        </label>
        {assetType !== "image" ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Duration (seconds)
            </span>
            <input
              name="durationSeconds"
              aria-label="Duration seconds"
              className={adminInputClass}
            />
          </label>
        ) : null}
        <label className="block">
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
        <div className="flex gap-3 pt-2">
          <button type="submit" className={adminPrimaryButtonClass}>
            Save media asset
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AssetEditorModal({
  asset,
  onClose,
  onDelete,
}: {
  asset: MediaAssetListItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [state, formAction] = useActionState(updateMediaAsset, initialState);

  return (
    <ModalShell title={`Edit ${asset.title}`} onClose={onClose} wide>
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
          <span className="text-sm font-medium text-slate-700">Alt text</span>
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
          <span className="text-sm font-medium text-slate-700">Caption</span>
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
        <div className="flex gap-3">
          <button type="submit" className={adminPrimaryButtonClass}>
            Save changes
          </button>
          <button
            type="button"
            className={`${adminSecondaryButtonClass} text-red-700`}
            onClick={onDelete}
          >
            Delete asset
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AssetUsageModal({
  asset,
  usage,
  usageMessage,
  isDeleting,
  onClose,
  onDelete,
}: {
  asset: MediaAssetListItem;
  usage: MediaAssetUsage | null;
  usageMessage: string | null;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <ModalShell title={asset.title} description="Asset usage" onClose={onClose}>
      {usageMessage ? (
        <p className="mb-4 text-sm text-slate-600">{usageMessage}</p>
      ) : null}
      {!usage ? (
        <p className="text-sm text-slate-500">Loading usage...</p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            {usage.totalCount === 0
              ? "This asset is not referenced anywhere."
              : `${usage.totalCount} reference${usage.totalCount === 1 ? "" : "s"} found.`}
          </p>
          <UsageList title="SEO pages" items={usage.seoPages} />
          <UsageList title="News posts" items={usage.newsPosts} />
          <UsageList title="Proof items" items={usage.proofItems} />
          <UsageList title="Source documents" items={usage.sourceDocuments} />
        </div>
      )}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <button
          type="button"
          className={`${adminSecondaryButtonClass} text-red-700`}
          disabled={isDeleting || Boolean(usage && usage.totalCount > 0)}
          onClick={onDelete}
        >
          Delete asset
        </button>
        {usage && usage.totalCount > 0 ? (
          <p className="mt-2 text-xs text-amber-700">
            Remove references before deleting this asset.
          </p>
        ) : null}
      </div>
    </ModalShell>
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
            {item.slug ? (
              <Link
                href={
                  title === "SEO pages"
                    ? `/admin/pages/${item.id}`
                    : title === "News posts"
                      ? `/admin/news/${item.id}`
                      : "#"
                }
                className="font-medium text-[#0b63f6] hover:text-slate-950"
              >
                {item.title ?? item.body ?? item.id}
              </Link>
            ) : (
              (item.title ?? item.body ?? item.id)
            )}
            {item.slug ? ` (${item.slug})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
        aria-labelledby="media-modal-title"
        className={`flex max-h-[min(760px,calc(100dvh-2rem))] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            {description ? (
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                {description}
              </p>
            ) : null}
            <h3
              id="media-modal-title"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

function formatAssetDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
