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
import type { NewsPost } from "@/lib/services/news";

type NewsEditorFormProps = {
  post?: Pick<
    NewsPost,
    | "id"
    | "title"
    | "slug"
    | "excerpt"
    | "body"
    | "author"
    | "cover_url"
    | "cover_alt"
    | "status"
    | "published_at"
  >;
  savedFromRedirect?: boolean;
};

const initialState: EditorActionState = { status: "idle" };

export function NewsEditorForm({
  post,
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
    <form
      action={formAction}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      {post?.id && <input type="hidden" name="id" value={post.id} />}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/news"
            className="text-brand-600 hover:text-brand-500 text-sm font-medium"
          >
            Back to posts
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {statusLabel}
          </span>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-2xl font-semibold text-slate-950 shadow-sm transition outline-none focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Slug</span>
          <input
            name="slug"
            value={visibleSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            required
            className="focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Excerpt</span>
          <textarea
            name="excerpt"
            defaultValue={post?.excerpt ?? ""}
            rows={3}
            maxLength={240}
            className="focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2"
          />
        </label>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              rows={24}
              className="min-h-[520px] w-full resize-y border-0 px-4 py-4 font-mono text-sm leading-6 text-slate-800 outline-none"
            />
          ) : (
            <>
              <input type="hidden" name="body" value={body} />
              <div
                className="news-prose min-h-[520px] px-5 py-5"
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
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
            <button className={primaryButtonClass} name="intent" value="save">
              Save draft
            </button>
            <button
              className={primaryButtonClass}
              name="intent"
              value="publish"
            >
              Publish
            </button>
            {canUnpublish && (
              <button
                className={secondaryButtonClass}
                name="intent"
                value="unpublish"
              >
                Unpublish
              </button>
            )}
            {canArchive && (
              <button
                className={secondaryButtonClass}
                name="intent"
                value="archive"
              >
                Archive
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Cover</h2>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              Image URL
            </span>
            <input
              name="cover_url"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              className="focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Upload</span>
            <input
              type="file"
              accept="image/avif,image/webp,image/png,image/jpeg"
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? null)
              }
              disabled={isUploading}
              className="file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
            />
          </label>
          {uploadMessage && (
            <p className="mt-2 text-xs text-slate-500">{uploadMessage}</p>
          )}
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Alt text</span>
            <input
              name="cover_alt"
              defaultValue={post?.cover_alt ?? ""}
              className="focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2"
            />
          </label>
        </div>

        <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-sm font-semibold text-slate-950">Author</span>
          <input
            name="author"
            defaultValue={post?.author ?? "Mike"}
            className="focus:border-brand-400 focus:ring-brand-100 mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2"
          />
        </label>
      </aside>
    </form>
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
      ? "bg-white text-brand-600"
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

const primaryButtonClass =
  "rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";

const secondaryButtonClass =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";
