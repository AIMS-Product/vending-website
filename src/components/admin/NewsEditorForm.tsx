"use client";

import type { FormEvent } from "react";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { savePost, type EditorActionState } from "@/app/admin/news/actions";
import { normalizeNewsSlug } from "@/app/admin/news/news-slug";
import {
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import { MediaPickerProvider } from "@/components/admin/MediaPickerProvider";
import { NewsCoverCard } from "@/components/admin/NewsCoverCard";
import { NewsMobileSaveBar } from "@/components/admin/NewsMobileSaveBar";
import { NewsPublishButton } from "@/components/admin/NewsPublishButton";
import { formatDate, tabClass } from "@/components/admin/news-editor-helpers";
import { useNewsAutosave } from "@/components/admin/useNewsAutosave";
import { formatPacificDateTime } from "@/lib/page-builder/datetime-format";
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
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [previewHtml, setPreviewHtml] = useState("");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [coverUrl, setCoverUrl] = useState(post?.cover_url ?? "");
  const [coverAlt, setCoverAlt] = useState(post?.cover_alt ?? "");

  const status = post?.status ?? "draft";
  const canUnpublish = status === "published";
  const canArchive = Boolean(post?.id) && status !== "archived";
  const visibleSlug = slugTouched ? slug : normalizeNewsSlug(title);

  // I5: background autosave for existing DRAFT rows only. Gated inside the hook
  // on post.id (a brand-new post has no row yet and relies on manual "Save
  // draft") and on draft status (news is single-source — a published post's
  // body is the live content, so autosave must never write it).
  const { autosave, clearAutosave } = useNewsAutosave({
    postId: post?.id ?? null,
    status,
    title,
    slug: visibleSlug,
    excerpt,
    body,
    coverUrl,
    coverAlt,
  });

  // A manual Save draft / Publish persists the whole row, so drop any pending
  // autosave failure indicator when the user takes the manual fallback.
  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name === "intent") {
      clearAutosave();
    }
  }

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

  return (
    <MediaPickerProvider initialAssets={mediaAssets}>
      <form
        id="news-editor-form"
        action={formAction}
        onSubmit={handleManualSubmit}
        className="grid gap-8 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-0"
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
              aria-describedby="news-slug-hint"
              value={visibleSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(normalizeNewsSlug(event.target.value));
              }}
              required
              className={`${adminInputClass} font-mono`}
            />
            {/* I13: tell the admin exactly what a valid slug looks like; the
                server normalizes/validates with the same rule as a backstop. */}
            <span
              id="news-slug-hint"
              className="mt-1.5 block text-xs text-slate-500"
            >
              Lowercase letters, numbers, and hyphens only — spaces and
              punctuation are removed automatically.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Excerpt</span>
            <textarea
              name="excerpt"
              aria-label="Excerpt"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
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

        <div className="space-y-5">
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
            {/* I5: quiet autosave indicator, mirroring the SEO page editor. The
                success state proves work is safe; the error state never claims
                "saved" and points to the manual Save draft fallback. */}
            {autosave?.status === "saved" && (
              <p className="mt-3 text-xs font-medium text-slate-500">
                Saved automatically · {formatPacificDateTime(autosave.savedAt)}
              </p>
            )}
            {autosave?.status === "error" && (
              <p className="mt-3 text-xs font-medium text-red-600">
                {autosave.message}
              </p>
            )}
            <div className="mt-5 grid gap-2">
              <button
                type="submit"
                className={adminSecondaryButtonClass}
                name="intent"
                value="save"
              >
                Save draft
              </button>
              <NewsPublishButton className={adminPrimaryButtonClass} />
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

          <NewsCoverCard
            coverUrl={coverUrl}
            coverAlt={coverAlt}
            onCoverUrlChange={setCoverUrl}
            onCoverAltChange={setCoverAlt}
          />
        </div>
      </form>
      <NewsMobileSaveBar formId="news-editor-form" />
    </MediaPickerProvider>
  );
}
