"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import {
  createMediaAsset,
  createSignedMediaUpload,
  type MediaAssetActionState,
} from "@/app/admin/media/actions";
import {
  AdminIcon,
  adminCardClass,
  adminInputClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import { createClient } from "@/lib/supabase/client";

export type MediaAssetListItem = {
  id: string;
  title: string;
  alt_text: string | null;
  caption: string | null;
  source_rights_notes: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
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
  const [externalUrl, setExternalUrl] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();

  function handleFileChange(file: File | null) {
    if (!file) return;
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
            required
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
        {assets.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No media assets found.</p>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-[#bdd3ff] hover:shadow-sm"
              >
                {asset.publicUrl && (
                  <Image
                    src={asset.publicUrl}
                    alt={asset.alt_text ?? ""}
                    width={640}
                    height={360}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="aspect-[16/9] w-full object-cover"
                  />
                )}
                <div className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">
                    {asset.title}
                  </h3>
                  <p className="text-xs text-slate-500">{asset.alt_text}</p>
                  <p className="font-mono text-xs break-all text-slate-600">
                    {asset.id}
                  </p>
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
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
