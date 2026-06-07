"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { createClient } from "@/lib/supabase/client";
import {
  createSignedImageUpload,
  savePost,
  type EditorActionState,
} from "@/app/admin/news/actions";
import {
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import {
  MediaLibrarySelectButton,
  MediaPickerProvider,
  useMediaPicker,
} from "@/components/admin/MediaPickerProvider";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import type { NewsPost } from "@/lib/services/news";

type NewsEditorFormProps = {
  post?: Pick<
    NewsPost,
    | "id"
    | "title"
    | "slug"
    | "excerpt"
    | "body"
    | "cover_url"
    | "cover_alt"
    | "status"
    | "published_at"
  >;
  mediaAssets?: EditorMediaAsset[];
  savedFromRedirect?: boolean;
};

const initialState: EditorActionState = { status: "idle" };

export function NewsEditorForm({
  post,
  mediaAssets = [],
  savedFromRedirect = false,
}: NewsEditorFormProps) {
  const [state, formAction] = useActionState(savePost, initialState);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post?.slug));
  const [body, setBody] = useState(post?.body ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [coverUrl, setCoverUrl] = useState(post?.cover_url ?? "");
  const [coverAlt, setCoverAlt] = useState(post?.cover_alt ?? "");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploading, startUploadTransition] = useTransition();

  const status = post?.status ?? "draft";
  const canUnpublish = status === "published";
  const canArchive = Boolean(post?.id) && status !== "archived";
  const visibleSlug = slugTouched ? slug : slugify(title);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderMarkdown(body).then((html) => {
        if (!cancelled) setPreviewHtml(html);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [body]);

  const statusLabel =
    status === "published" && post?.published_at
      ? `Published ${formatDate(post.published_at)}`
      : status[0].toUpperCase() + status.slice(1);

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
        setCoverUrl(signed.publicUrl);
        setUploadMessage("Cover image uploaded.");
      } catch (error) {
        console.error("cover upload failed", error);
        setUploadMessage("Could not upload the image.");
      }
    });
  }

  return (
    <MediaPickerProvider initialAssets={mediaAssets}>
      <form
        action={formAction}
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        {post?.id && <input type="hidden" name="id" value={post.id} />}

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin/news"
              className="text-sm font-semibold text-[#0b63f6] hover:text-[#0756d6]"
            >
              Back to posts
            </Link>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {statusLabel}
            </span>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <input
              name="title"
              aria-label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-2xl font-semibold text-slate-950 shadow-sm transition outline-none focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Slug</span>
            <input
              name="slug"
              aria-label="Slug"
              value={visibleSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              required
              className={`${adminInputClass} font-mono`}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Excerpt</span>
            <textarea
              name="excerpt"
              aria-label="Excerpt"
              defaultValue={post?.excerpt ?? ""}
              rows={3}
              maxLength={240}
              className={adminTextareaClass}
            />
          </label>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={tabClass(activeTab === "write")}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={tabClass(activeTab === "preview")}
              >
                Preview
              </button>
            </div>
            {activeTab === "write" ? (
              <textarea
                name="body"
                aria-label="Body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                rows={24}
                className="min-h-[520px] w-full resize-y border-0 p-4 font-mono text-sm leading-6 text-slate-800 outline-none"
              />
            ) : (
              <>
                <input type="hidden" name="body" value={body} />
                <div
                  className="news-prose min-h-[520px] p-5"
                  dangerouslySetInnerHTML={{
                    __html:
                      previewHtml ||
                      "<p>Start writing to preview the article.</p>",
                  }}
                />
              </>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className={adminCardClass}>
            <h2 className="text-sm font-semibold text-slate-950">Publish</h2>
            {(state.status !== "idle" || savedFromRedirect) && (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                  state.status === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {state.message ?? "Post saved."}
              </p>
            )}
            <div className="mt-5 grid gap-2">
              <button
                type="submit"
                className={adminPrimaryButtonClass}
                name="intent"
                value="save"
              >
                Save draft
              </button>
              <button
                type="submit"
                className={adminPrimaryButtonClass}
                name="intent"
                value="publish"
              >
                Publish
              </button>
              {canUnpublish && (
                <button
                  type="submit"
                  className={adminSecondaryButtonClass}
                  name="intent"
                  value="unpublish"
                >
                  Unpublish
                </button>
              )}
              {canArchive && (
                <button
                  type="submit"
                  className={adminSecondaryButtonClass}
                  name="intent"
                  value="archive"
                >
                  Archive
                </button>
              )}
            </div>
          </div>

          <div className={adminCardClass}>
            <h2 className="text-sm font-semibold text-slate-950">Cover</h2>
            <div className="mt-4">
              <CoverLibraryButton
                onSelect={(asset) => {
                  setCoverUrl(asset.publicUrl);
                  setCoverAlt(asset.altText);
                }}
              />
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">
                Image URL
              </span>
              <input
                name="cover_url"
                aria-label="Cover image URL"
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
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
              <span className="text-sm font-medium text-slate-700">
                Alt text
              </span>
              <input
                name="cover_alt"
                aria-label="Cover image alt text"
                value={coverAlt}
                onChange={(event) => setCoverAlt(event.target.value)}
                className={adminInputClass}
              />
            </label>
          </div>
        </aside>
      </form>
    </MediaPickerProvider>
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function tabClass(active: boolean) {
  return `px-4 py-3 text-sm font-medium transition ${
    active
      ? "bg-white text-[#0b63f6]"
      : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
  }`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
