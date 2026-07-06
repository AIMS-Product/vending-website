"use client";

import { useState, useTransition } from "react";
import { createSignedImageUpload } from "@/app/admin/news/actions";
import { adminCardClass, adminInputClass } from "@/components/admin/AdminUi";
import {
  MediaLibrarySelectButton,
  useMediaPicker,
} from "@/components/admin/MediaPickerProvider";
import { createClient } from "@/lib/supabase/client";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";

// Cover fields extracted from NewsEditorForm to keep that component under the
// 300-line limit after the I5 autosave / I12 confirm wiring. State stays lifted
// to the parent (via props) so the autosave hook still observes cover edits.

type NewsCoverCardProps = {
  coverUrl: string;
  coverAlt: string;
  onCoverUrlChange: (value: string) => void;
  onCoverAltChange: (value: string) => void;
};

export function NewsCoverCard({
  coverUrl,
  coverAlt,
  onCoverUrlChange,
  onCoverAltChange,
}: NewsCoverCardProps) {
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();

  function handleFileChange(file: File | null) {
    if (!file) return;
    setUploadMessage(null);
    startUploadTransition(async () => {
      try {
        const request = new FormData();
        request.set("filename", file.name);
        const signed = await createSignedImageUpload(request);
        const supabase = createClient();
        const { error } = await supabase.storage
          .from("news-images")
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });
        if (error) throw error;
        onCoverUrlChange(signed.publicUrl);
        setUploadMessage("Cover image uploaded.");
      } catch (error) {
        console.error("cover upload failed", error);
        setUploadMessage("Could not upload the image.");
      }
    });
  }

  return (
    <div className={adminCardClass}>
      <h2 className="text-sm font-semibold text-slate-950">Cover</h2>
      <div className="mt-4">
        <CoverLibraryButton
          onSelect={(asset) => {
            onCoverUrlChange(asset.publicUrl);
            onCoverAltChange(asset.altText);
          }}
        />
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Image URL</span>
        <input
          name="cover_url"
          aria-label="Cover image URL"
          value={coverUrl}
          onChange={(event) => onCoverUrlChange(event.target.value)}
          className={adminInputClass}
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Upload</span>
        <input
          type="file"
          aria-label="Upload cover image"
          accept="image/avif,image/webp,image/png,image/jpeg"
          onChange={(event) =>
            handleFileChange(event.target.files?.[0] ?? null)
          }
          disabled={isUploading}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#e9f1ff] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#0b63f6] hover:file:bg-[#dceaff]"
        />
      </label>
      {uploadMessage && (
        <p className="mt-2 text-xs text-slate-500">{uploadMessage}</p>
      )}
      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Alt text</span>
        <input
          name="cover_alt"
          aria-label="Cover image alt text"
          value={coverAlt}
          onChange={(event) => onCoverAltChange(event.target.value)}
          className={adminInputClass}
        />
      </label>
    </div>
  );
}

function CoverLibraryButton({
  onSelect,
}: {
  onSelect: (asset: EditorMediaAsset) => void;
}) {
  const { openMediaPicker } = useMediaPicker();
  return (
    <MediaLibrarySelectButton
      label="Choose from media library"
      onClick={() =>
        openMediaPicker({
          allowedTypes: ["image"],
          onSelect,
        })
      }
    />
  );
}
