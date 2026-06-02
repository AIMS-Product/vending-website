import { createSeoPageComment } from "@/app/admin/pages/actions";
import {
  adminInputClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import type { Tables } from "@/types/database";

export function SeoPageCommentsPanel({
  pageId,
  comments,
  commentError,
}: {
  pageId: string;
  comments: Tables<"page_builder_comments">[];
  commentError?: string;
}) {
  return (
    <section className={`${adminPanelClass} mt-5 p-5`} aria-label="Comments">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-950">
          Governance comments
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Internal page and block notes stay out of previews and public pages.
        </p>
      </div>
      {commentError ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          {commentError}
        </p>
      ) : null}
      <form action={createSeoPageComment} className="grid gap-3">
        <input type="hidden" name="pageId" value={pageId} />
        <div>
          <label
            htmlFor="seo-comment-block-id"
            className="text-xs font-semibold text-slate-600 uppercase"
          >
            Block ID
          </label>
          <input
            id="seo-comment-block-id"
            name="blockId"
            placeholder="Optional block ID"
            className={adminInputClass}
          />
        </div>
        <div>
          <label
            htmlFor="seo-comment-body"
            className="text-xs font-semibold text-slate-600 uppercase"
          >
            Comment
          </label>
          <textarea
            id="seo-comment-body"
            name="body"
            required
            rows={3}
            placeholder="Add an internal note"
            className={adminTextareaClass}
          />
        </div>
        <div>
          <button type="submit" className={adminPrimaryButtonClass}>
            Add comment
          </button>
        </div>
      </form>
      <div className="mt-5 divide-y divide-slate-200">
        {comments.map((comment) => (
          <article key={comment.id} className="py-3">
            <p className="text-sm leading-6 text-slate-800">{comment.body}</p>
            <p className="mt-1 text-xs text-slate-500">
              {comment.block_id ? `Block ${comment.block_id} · ` : ""}
              {new Date(comment.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {comment.resolved_at ? " · resolved" : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
