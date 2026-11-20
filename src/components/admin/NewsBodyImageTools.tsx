"use client";

import { useRef, useState, useTransition } from "react";
import { adminSecondaryButtonClass } from "@/components/admin/AdminUi";
import { useMediaPicker } from "@/components/admin/MediaPickerProvider";
import {
  altFromFilename,
  uploadErrorMessage,
  uploadNewsImage,
} from "@/components/admin/news-image-upload";

// Puts an image inside the article body as Markdown (`![alt](url)`), which the
// public renderer already turns into an <img>. Upload or pick from the library.
export function NewsBodyImageTools({
  onInsert,
}: {
  onInsert: (markdown: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const { openMediaPicker } = useMediaPicker();

  function insert(url: string, alt: string) {
    onInsert(`![${alt.replace(/[[\]]/g, "")}](${url})`);
    setMessage(
      "Image added to the article. Edit the text in [ ] to describe it.",
    );
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setMessage(null);
    startUpload(async () => {
      try {
        insert(await uploadNewsImage(file), altFromFilename(file.name));
      } catch (error) {
        setMessage(uploadErrorMessage("body image upload failed", error));
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <div className="border-ui-line bg-ui-canvas flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <button
        type="button"
        className={adminSecondaryButtonClass}
        disabled={isUploading}
        onClick={() => fileRef.current?.click()}
      >
        {isUploading ? "Uploading image..." : "Upload image"}
      </button>
      <button
        type="button"
        className={adminSecondaryButtonClass}
        onClick={() =>
          openMediaPicker({
            allowedTypes: ["image"],
            onSelect: (asset) => insert(asset.publicUrl, asset.altText),
          })
        }
      >
        Image from library
      </button>
      <input
        ref={fileRef}
        type="file"
        hidden
        aria-label="Upload an image into the article"
        accept="image/avif,image/webp,image/png,image/jpeg"
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />
      {message && (
        <p role="status" className="text-ui-text-subtle w-full text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
