"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { createMediaAssetFromEditor } from "@/app/admin/media/actions";
import {
  AdminIcon,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import {
  EDITOR_UPLOAD_RIGHTS_NOTES,
  IMAGE_ACCEPT,
  defaultEditorImageFields,
  isAcceptedEditorImageFile,
  uploadImageFileToMediaLibrary,
  uploadImageFileToStorage,
} from "@/lib/media/editor-upload";

export type { EditorMediaAsset };

type MediaPickerAllowedType = EditorMediaAsset["assetType"];

type MediaPickerRequest = {
  allowedTypes: MediaPickerAllowedType[];
  onSelect: (asset: EditorMediaAsset) => void;
};

type MediaPickerContextValue = {
  assets: EditorMediaAsset[];
  openMediaPicker: (request: MediaPickerRequest) => void;
  addAsset: (asset: EditorMediaAsset) => void;
  uploadImageAsset: (file: File) => Promise<EditorMediaAsset>;
};

const MediaPickerContext = createContext<MediaPickerContextValue | null>(null);

export function MediaPickerProvider({
  initialAssets,
  children,
}: {
  initialAssets: EditorMediaAsset[];
  children: ReactNode;
}) {
  const [uploadedAssets, setUploadedAssets] = useState<EditorMediaAsset[]>([]);
  const [request, setRequest] = useState<MediaPickerRequest | null>(null);

  const assets = useMemo(() => {
    const byId = new Map<string, EditorMediaAsset>();
    for (const asset of initialAssets) {
      byId.set(asset.id, asset);
    }
    for (const asset of uploadedAssets) {
      byId.set(asset.id, asset);
    }
    return [...byId.values()];
  }, [initialAssets, uploadedAssets]);

  const openMediaPicker = useCallback((next: MediaPickerRequest) => {
    setRequest(next);
  }, []);

  const addAsset = useCallback((asset: EditorMediaAsset) => {
    setUploadedAssets((current) => [
      asset,
      ...current.filter((item) => item.id !== asset.id),
    ]);
  }, []);

  const uploadImageAsset = useCallback(
    async (file: File) => {
      const asset = await uploadImageFileToMediaLibrary(file);
      addAsset(asset);
      return asset;
    },
    [addAsset],
  );

  const value = useMemo(
    () => ({ assets, openMediaPicker, addAsset, uploadImageAsset }),
    [addAsset, assets, openMediaPicker, uploadImageAsset],
  );

  return (
    <MediaPickerContext.Provider value={value}>
      {children}
      {request && (
        <MediaPickerModal
          assets={assets}
          allowedTypes={request.allowedTypes}
          onSelect={(asset) => {
            request.onSelect(asset);
            setRequest(null);
          }}
          onClose={() => setRequest(null)}
          onAssetCreated={addAsset}
          uploadImageAsset={uploadImageAsset}
        />
      )}
    </MediaPickerContext.Provider>
  );
}

export function useMediaPicker() {
  const context = useContext(MediaPickerContext);
  if (!context) {
    throw new Error("useMediaPicker must be used within MediaPickerProvider.");
  }
  return context;
}

export function MediaDropTarget({
  label,
  hint,
  libraryLabel = "Choose from library",
  className,
  onAsset,
  onOpenLibrary,
}: {
  label: string;
  hint: string;
  libraryLabel?: string;
  className?: string;
  onAsset: (asset: EditorMediaAsset) => void;
  onOpenLibrary?: () => void;
}) {
  const { uploadImageAsset } = useMediaPicker();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();

  function handleDragState(event: DragEvent, dragging: boolean) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(dragging);
  }

  function uploadFile(file: File | null) {
    if (!file) return;
    setMessage(null);
    startUploadTransition(async () => {
      try {
        const asset = await uploadImageAsset(file);
        onAsset(asset);
        setMessage("Image added to the media library.");
      } catch (error) {
        console.error("editor image upload failed", error);
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not upload the image.",
        );
      }
    });
  }

  return (
    <div
      className={`relative grid place-items-center text-center ${className ?? ""} ${
        isDragging
          ? "border-[#0b63f6] bg-[#f5fbff] ring-4 ring-[#0b63f6]/15"
          : ""
      }`}
      onDragEnter={(event) => handleDragState(event, true)}
      onDragOver={(event) => handleDragState(event, true)}
      onDragLeave={(event) => handleDragState(event, false)}
      onDrop={(event) => {
        handleDragState(event, false);
        uploadFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          uploadFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <div className="px-4 py-8">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="text-sm text-slate-500 transition hover:text-slate-700 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
        >
          <span className="block font-semibold text-slate-600">
            {isUploading ? "Uploading image..." : label}
          </span>
          <span className="mt-1 block text-xs text-slate-500">{hint}</span>
        </button>
        {onOpenLibrary ? (
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-[#0b63f6] hover:text-slate-950"
            onClick={onOpenLibrary}
          >
            {libraryLabel}
          </button>
        ) : null}
        {message ? (
          <p className="mt-2 text-xs text-slate-500" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MediaPickerModal({
  assets,
  allowedTypes,
  onSelect,
  onClose,
  onAssetCreated,
  uploadImageAsset,
}: {
  assets: EditorMediaAsset[];
  allowedTypes: MediaPickerAllowedType[];
  onSelect: (asset: EditorMediaAsset) => void;
  onClose: () => void;
  onAssetCreated: (asset: EditorMediaAsset) => void;
  uploadImageAsset: (file: File) => Promise<EditorMediaAsset>;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"library" | "upload">("library");
  const [uploadAssetType, setUploadAssetType] =
    useState<MediaPickerAllowedType>(allowedTypes[0] ?? "image");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [sourceRightsNotes, setSourceRightsNotes] = useState(
    EDITOR_UPLOAD_RIGHTS_NOTES,
  );
  const [caption, setCaption] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [isDropActive, setIsDropActive] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (!allowedTypes.includes(asset.assetType)) return false;
      if (!term) return true;
      return (
        asset.title.toLowerCase().includes(term) ||
        asset.altText.toLowerCase().includes(term)
      );
    });
  }, [allowedTypes, assets, search]);

  function applyUploadedFileDefaults(file: File) {
    const defaults = defaultEditorImageFields(file);
    setTitle(defaults.title);
    setAltText(defaults.altText);
    if (!sourceRightsNotes.trim()) {
      setSourceRightsNotes(defaults.sourceRightsNotes);
    }
  }

  function handleFileChange(file: File | null) {
    if (!file || uploadAssetType !== "image") return;
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
        setUploadMessage(
          "Image uploaded. Saving adds it to the media library.",
        );
      } catch (error) {
        console.error("media upload failed", error);
        setUploadMessage("Could not upload the image.");
      }
    });
  }

  async function handleQuickImageUpload(file: File) {
    setSaveMessage(null);
    try {
      const asset = await uploadImageAsset(file);
      onAssetCreated(asset);
      onSelect(asset);
    } catch (error) {
      console.error("quick media upload failed", error);
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save media.",
      );
    }
  }

  function handleSaveAsset() {
    setSaveMessage(null);
    startSaveTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("assetType", uploadAssetType);
        formData.set("title", title);
        formData.set("altText", altText);
        formData.set("sourceRightsNotes", sourceRightsNotes);
        formData.set("caption", caption);
        formData.set("externalUrl", externalUrl);
        formData.set("storageBucket", storageBucket);
        formData.set("storagePath", storagePath);
        const asset = await createMediaAssetFromEditor(formData);
        onAssetCreated(asset);
        onSelect(asset);
      } catch (error) {
        console.error("media asset save failed", error);
        setSaveMessage(
          error instanceof Error ? error.message : "Could not save media.",
        );
      }
    });
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        className="flex max-h-[min(820px,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Media library
            </p>
            <h2
              id="media-picker-title"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              Choose media
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close media picker"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </header>

        <div className="flex shrink-0 gap-2 border-b border-slate-200 px-5 py-3">
          <button
            type="button"
            className={
              mode === "library"
                ? adminPrimaryButtonClass
                : adminSecondaryButtonClass
            }
            onClick={() => setMode("library")}
          >
            Library
          </button>
          <button
            type="button"
            className={
              mode === "upload"
                ? adminPrimaryButtonClass
                : adminSecondaryButtonClass
            }
            onClick={() => setMode("upload")}
          >
            Upload or link
          </button>
        </div>

        {mode === "library" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-200 px-5 py-3">
              <label className="flex h-11 items-center gap-3 rounded-md border border-slate-200 bg-white px-3">
                <span className="text-slate-500" aria-hidden="true">
                  <AdminIcon icon="search" />
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title or alt text"
                  aria-label="Search media assets"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {filteredAssets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No matching assets. Upload a new asset or open the full media
                  library.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onSelect(asset)}
                      className="overflow-hidden rounded-md border border-slate-200 bg-white text-left transition hover:border-[#0b63f6]/40 hover:shadow-sm"
                    >
                      {asset.publicUrl && asset.assetType === "image" ? (
                        <Image
                          src={asset.publicUrl}
                          alt={asset.altText}
                          width={480}
                          height={270}
                          sizes="(max-width: 768px) 100vw, 240px"
                          className="aspect-[16/9] w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-[16/9] place-items-center bg-slate-50 px-4 text-center text-xs font-semibold text-slate-600 uppercase">
                          {asset.assetType} asset
                        </div>
                      )}
                      <div className="space-y-1 p-3">
                        <p className="text-sm font-semibold text-slate-950">
                          {asset.title}
                        </p>
                        <p className="line-clamp-2 text-xs text-slate-500">
                          {asset.altText || asset.publicUrl}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {uploadAssetType === "image" ? (
              <div
                className={`mb-5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                  isDropActive
                    ? "border-[#0b63f6] bg-[#f5fbff]"
                    : "border-slate-200 bg-slate-50"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDropActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDropActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDropActive(false);
                  const file = event.dataTransfer.files?.[0] ?? null;
                  if (file) void handleQuickImageUpload(file);
                }}
              >
                <p className="text-sm font-semibold text-slate-700">
                  Drop an image here
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Images dropped here are saved to the media library
                  automatically.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <select
                  value={uploadAssetType}
                  onChange={(event) => {
                    const next = event.target.value as MediaPickerAllowedType;
                    setUploadAssetType(next);
                    if (next !== "image") {
                      setStorageBucket("");
                      setStoragePath("");
                    }
                  }}
                  className={adminInputClass}
                >
                  {allowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={adminInputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Alt text
                </span>
                <input
                  value={altText}
                  onChange={(event) => setAltText(event.target.value)}
                  className={adminInputClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Rights notes
                </span>
                <textarea
                  value={sourceRightsNotes}
                  onChange={(event) => setSourceRightsNotes(event.target.value)}
                  rows={3}
                  className={adminTextareaClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Caption
                </span>
                <input
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  className={adminInputClass}
                />
              </label>
              {uploadAssetType === "image" ? (
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Upload image
                  </span>
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    disabled={isUploading}
                    onChange={(event) =>
                      handleFileChange(event.target.files?.[0] ?? null)
                    }
                    className="mt-2 block w-full text-sm text-slate-700"
                  />
                  {uploadMessage && (
                    <p className="mt-2 text-xs text-slate-500">
                      {uploadMessage}
                    </p>
                  )}
                </label>
              ) : null}
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  External URL
                </span>
                <input
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
            </div>
            {saveMessage && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveMessage}
              </p>
            )}
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAsset}
              className={`${adminPrimaryButtonClass} mt-5`}
            >
              Save and use asset
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export function MediaLibrarySelectButton({
  label,
  onClick,
  className = adminSecondaryButtonClass,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
