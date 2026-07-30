"use client";

import type { PublishBlockerChecklistItem } from "@/components/admin/seo-page-editor/publish-blocker-checklist";

// Stable id the Publish button points at via aria-describedby, and the live
// region the checklist announces through.
export const PUBLISH_BLOCKER_LIST_ID = "publish-blocker-checklist";

// I11: the ONE canonical readiness surface is this checklist. Other surfaces
// (the verdict card, the disabled Publish button) may point at it but must not
// re-render the full "N to fix" list. This helper is the single "jump to the
// checklist" behavior they share, so scroll/focus never drifts between them.
// Returns true when the checklist was found and focused.
export function focusPublishBlockerChecklist(): boolean {
  const list = document.getElementById(PUBLISH_BLOCKER_LIST_ID);
  const firstItem = list?.querySelector<HTMLElement>("button");
  if (!firstItem) return false;
  list?.scrollIntoView({ behavior: "smooth", block: "center" });
  firstItem.focus();
  return true;
}

function actionVerbForTarget(item: PublishBlockerChecklistItem) {
  if (item.target.kind === "save-first") return "Save draft";
  if (item.target.kind === "block-modal") return "Open block settings";
  if (item.target.kind === "field") return "Go to field";
  return "Show in page";
}

export function PublishBlockerChecklist({
  items,
  onFocusBlocker,
}: {
  items: PublishBlockerChecklistItem[];
  onFocusBlocker: (item: PublishBlockerChecklistItem) => void;
}) {
  const hasBlockers = items.length > 0;

  return (
    <section
      aria-labelledby="publish-blocker-checklist-title"
      className="rounded-ui-lg border-ui-warn/25 bg-ui-warn-fill border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="publish-blocker-checklist-title"
          className="text-ui-warn-ink text-sm font-semibold"
        >
          Before you can publish
        </h3>
        {hasBlockers ? (
          <span className="rounded-ui bg-ui-surface text-ui-warn-ink ring-ui-warn/25 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset">
            {items.length} to fix
          </span>
        ) : null}
      </div>

      {/* Single persistent list of every publish blocker. The chip count and
          the disabled Publish button both derive from the same list this
          renders. Updates are announced through aria-live. */}
      <ul
        id={PUBLISH_BLOCKER_LIST_ID}
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 grid gap-2"
      >
        {hasBlockers ? (
          items.map((item) => (
            <li key={`${item.code}-${item.label}`}>
              <button
                type="button"
                onClick={() => onFocusBlocker(item)}
                className="rounded-ui-lg border-ui-warn/25 bg-ui-surface text-ui-warn-ink shadow-ui hover:border-ui-warn/25 hover:bg-ui-warn-fill focus-visible:ring-ui-warn/70 flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left text-sm font-medium transition focus-visible:ring-4 focus-visible:outline-none"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="bg-ui-warn mt-1.5 size-1.5 shrink-0 rounded-full"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{item.label}</span>
                </span>
                <span className="text-ui-warn-ink shrink-0 text-xs font-semibold">
                  {actionVerbForTarget(item)}
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="rounded-ui-lg border-ui-ok/25 bg-ui-ok-fill text-ui-ok-ink border px-3 py-2.5 text-sm font-medium">
            No publish blockers — this page can be published.
          </li>
        )}
      </ul>
    </section>
  );
}
