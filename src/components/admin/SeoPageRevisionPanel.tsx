"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  createSeoPagePreviewLink,
  refreshSeoPageLibraryReferences,
  revokeSeoPagePreviewLink,
  rollbackSeoPageRevision,
  type PagePreviewLinkActionState,
} from "@/app/admin/pages/actions";
import {
  adminCardClass,
  adminDangerButtonClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";

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
  publishedRevisionId?: string | null;
  revisions: RevisionRow[];
  previewTokens: PreviewTokenRow[];
};

const initialPreviewState: PagePreviewLinkActionState = { status: "idle" };

export function SeoPageRevisionPanel({
  pageId,
  publishedRevisionId,
  revisions,
  previewTokens,
}: SeoPageRevisionPanelProps) {
  const [previewState, previewAction] = useActionState(
    createSeoPagePreviewLink,
    initialPreviewState,
  );
  const [restoreRevision, setRestoreRevision] = useState<RevisionRow | null>(
    null,
  );
  const restoreDialogTitleId = useId();
  const restoreDialogRef = useRef<HTMLDivElement>(null);
  const restoreCancelButtonRef = useRef<HTMLButtonElement>(null);
  const restoreReturnFocusRef = useRef<HTMLElement | null>(null);
  const versionNumberById = useMemo(() => {
    const entries = [...revisions]
      .reverse()
      .map((revision, index) => [revision.id, index + 1] as const);
    return new Map(entries);
  }, [revisions]);

  useEffect(() => {
    if (!restoreRevision) return;

    restoreReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = restoreDialogRef.current;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setRestoreRevision(null);
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusableElements = getDialogFocusableElements(dialog);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    dialog?.addEventListener("keydown", handleKeyDown);
    restoreCancelButtonRef.current?.focus();

    return () => {
      dialog?.removeEventListener("keydown", handleKeyDown);
      restoreReturnFocusRef.current?.focus();
      restoreReturnFocusRef.current = null;
    };
  }, [restoreRevision]);

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className={adminPanelClass}>
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Revision history
          </h2>
        </header>
        {revisions.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Revisions appear after publishing, library refreshes, or draft
            restores.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {revisions.map((revision, index) => {
              const versionNumber = versionNumberById.get(revision.id);
              return (
                <article
                  key={revision.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">
                        {revisionTitle(revision, versionNumber)}
                      </p>
                      {versionNumber && (
                        <RevisionChip>Version {versionNumber}</RevisionChip>
                      )}
                      {revision.id === publishedRevisionId && (
                        <RevisionChip tone="live">Live</RevisionChip>
                      )}
                      {index === 0 && <RevisionChip>Latest</RevisionChip>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {revisionTypeLabel(revision.revision_type)} -{" "}
                      {formatDateTime(revision.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/pages/${pageId}/revisions/${revision.id}`}
                      className={adminSmallButtonClass}
                    >
                      Preview
                    </Link>
                    <button
                      type="button"
                      className={adminSmallButtonClass}
                      onClick={() => setRestoreRevision(revision)}
                    >
                      Restore draft
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className={adminCardClass}>
        <h2 className="text-sm font-semibold text-slate-950">Draft preview</h2>
        <form action={refreshSeoPageLibraryReferences} className="mt-4">
          <input type="hidden" name="pageId" value={pageId} />
          <button type="submit" className={adminSmallButtonClass}>
            Refresh libraries
          </button>
        </form>
        <form action={previewAction} className="mt-4">
          <input type="hidden" name="pageId" value={pageId} />
          <button type="submit" className={adminPrimaryButtonClass}>
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
            className="mt-3 block text-sm font-semibold break-all text-[#0b63f6] hover:text-[#0756d6]"
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
                      <button type="submit" className={adminDangerButtonClass}>
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
      {restoreRevision && (
        <div
          ref={restoreDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={restoreDialogTitleId}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h2
              id={restoreDialogTitleId}
              className="text-base font-semibold text-slate-950"
            >
              Restore this revision as draft?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This copies {revisionTitle(restoreRevision)} into the editor
              draft. The live page stays unchanged until you publish again.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={restoreCancelButtonRef}
                type="button"
                className={adminSmallButtonClass}
                onClick={() => setRestoreRevision(null)}
              >
                Cancel
              </button>
              <form action={rollbackSeoPageRevision}>
                <input type="hidden" name="pageId" value={pageId} />
                <input
                  type="hidden"
                  name="revisionId"
                  value={restoreRevision.id}
                />
                <button type="submit" className={adminPrimaryButtonClass}>
                  Restore draft
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDialogFocusableElements(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

function RevisionChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "live";
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === "live"
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function revisionTitle(revision: RevisionRow, versionNumber?: number) {
  const label = revision.label?.trim();
  if (label?.startsWith("Publish: ")) return label.replace("Publish: ", "");
  if (label && !label.startsWith("Publish ")) return label;
  if (revision.revision_type === "publish") {
    return versionNumber ? `Published version ${versionNumber}` : "Published";
  }
  return revisionTypeLabel(revision.revision_type);
}

function revisionTypeLabel(type: string) {
  if (type === "publish") return "Published";
  if (type === "rollback") return "Draft restored";
  if (type === "manual_save") return "Manual save";
  if (type === "ai_insert") return "AI insert";
  if (type === "autosave") return "Autosave";
  return type.replace(/_/g, " ");
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
