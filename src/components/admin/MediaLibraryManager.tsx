"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createMediaAsset,
  createSignedMediaUpload,
  type MediaAssetActionState,
} from "@/app/admin/media/actions";
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
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form
        action={formAction}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-950">Add media</h2>
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
          <input name="title" required className={inputClass} />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Alt text</span>
          <input name="altText" required className={inputClass} />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">
            Rights notes
          </span>
          <textarea
            name="sourceRightsNotes"
            required
            rows={3}
            className={textareaClass}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Caption</span>
          <input name="caption" className={inputClass} />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <input name="tags" className={inputClass} placeholder="hero, proof" />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Upload</span>
          <input
            type="file"
            accept="image/avif,image/webp,image/png,image/jpeg"
            disabled={isUploading}
            onChange={(event) =>
              handleFileChange(event.target.files?.[0] ?? null)
            }
            className="file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
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
            value={externalUrl}
            onChange={(event) => {
              setExternalUrl(event.target.value);
              if (event.target.value) {
                setStorageBucket("");
                setStoragePath("");
              }
            }}
            className={inputClass}
          />
        </label>
        <input type="hidden" name="storageBucket" value={storageBucket} />
        <input type="hidden" name="storagePath" value={storagePath} />
        <button type="submit" className={`${primaryButtonClass} mt-5`}>
          Save media asset
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
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
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                {asset.publicUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.publicUrl}
                    alt={asset.alt_text ?? ""}
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
                          className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600"
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

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2";

const textareaClass =
  "focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm transition outline-none focus:ring-2";

const primaryButtonClass =
  "rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";
