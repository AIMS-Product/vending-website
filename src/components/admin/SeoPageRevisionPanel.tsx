"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createSeoPagePreviewLink,
  refreshSeoPageLibraryReferences,
  revokeSeoPagePreviewLink,
  rollbackSeoPageRevision,
  type PagePreviewLinkActionState,
} from "@/app/admin/pages/actions";

type RevisionRow = {
  id: string;
  revision_type: string;
  label: string | null;
  created_at: string;
  created_by: string | null;
};

type PreviewTokenRow = {
  id: string;
  token_prefix: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

type SeoPageRevisionPanelProps = {
  pageId: string;
  revisions: RevisionRow[];
  previewTokens: PreviewTokenRow[];
};

const initialPreviewState: PagePreviewLinkActionState = { status: "idle" };

export function SeoPageRevisionPanel({
  pageId,
  revisions,
  previewTokens,
}: SeoPageRevisionPanelProps) {
  const [previewState, previewAction] = useActionState(
    createSeoPagePreviewLink,
    initialPreviewState,
  );

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Revision history
          </h2>
        </header>
        {revisions.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Revisions appear after publishing or rollback.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {revisions.map((revision) => (
              <article
                key={revision.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {revision.label ?? revision.revision_type}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {revision.revision_type} -{" "}
                    {formatDateTime(revision.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/pages/${pageId}/revisions/${revision.id}`}
                    className={secondaryButtonClass}
                  >
                    Preview
                  </Link>
                  <form action={rollbackSeoPageRevision}>
                    <input type="hidden" name="pageId" value={pageId} />
                    <input
                      type="hidden"
                      name="revisionId"
                      value={revision.id}
                    />
                    <button type="submit" className={secondaryButtonClass}>
                      Roll back
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">Draft preview</h2>
        <form action={refreshSeoPageLibraryReferences} className="mt-4">
          <input type="hidden" name="pageId" value={pageId} />
          <button type="submit" className={secondaryButtonClass}>
            Refresh libraries
          </button>
        </form>
        <form action={previewAction} className="mt-4">
          <input type="hidden" name="pageId" value={pageId} />
          <button type="submit" className={primaryButtonClass}>
            Create preview link
          </button>
        </form>
        {previewState.status !== "idle" && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              previewState.status === "error"
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {previewState.message}
          </p>
        )}
        {previewState.status === "created" && previewState.previewPath && (
          <Link
            href={previewState.previewPath}
            target="_blank"
            className="text-brand-600 hover:text-brand-500 mt-3 block text-sm font-medium break-all"
          >
            {previewState.previewPath}
          </Link>
        )}

        <div className="mt-6 space-y-3">
          {previewTokens.map((token) => {
            const status = previewTokenStatus(token);
            return (
              <div
                key={token.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-slate-700">
                      {token.token_prefix}...
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {status} - expires {formatDateTime(token.expires_at)}
                    </p>
                  </div>
                  {status === "Active" && (
                    <form action={revokeSeoPagePreviewLink}>
                      <input type="hidden" name="pageId" value={pageId} />
                      <input type="hidden" name="tokenId" value={token.id} />
                      <button type="submit" className={dangerButtonClass}>
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function previewTokenStatus(token: PreviewTokenRow) {
  if (token.revoked_at) return "Revoked";
  if (new Date(token.expires_at).getTime() <= Date.now()) return "Expired";
  return "Active";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

const primaryButtonClass =
  "rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";

const secondaryButtonClass =
  "inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

const dangerButtonClass =
  "rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50";
