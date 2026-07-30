"use client";

import Link from "next/link";
import type { PageBlock, PageContent } from "@/lib/page-builder/blocks";
import type { InternalLinkSuggestion } from "@/lib/page-builder/internal-link-suggestions";
import type {
  SeoReadinessFinding,
  SeoReadinessSummary,
} from "@/lib/page-builder/seo-readiness";
import {
  anchorForFinding,
  findingSeverityLabel,
  friendlyEvidenceText,
  friendlyFindingLocation,
  friendlyReadinessCategoryLabel,
  requiresSeoSettings,
  suggestedBlockForFinding,
  thinPageWarning,
  type NextPublishStep,
} from "@/components/admin/seo-page-editor/SeoReadinessHelpers";
import {
  findingDotClass,
  labelForReadinessStatus,
  readinessCategoryClass,
  readinessPillClass,
  smallButtonClass,
} from "@/components/admin/seo-page-editor/editor-styles";

export function NextPublishStepCard({ step }: { step: NextPublishStep }) {
  const toneClass =
    step.tone === "ready"
      ? "border-ui-ok/25 bg-ui-ok-fill text-ui-ok-ink"
      : step.tone === "blocked"
        ? "border-ui-warn/25 bg-ui-warn-fill text-ui-warn-ink"
        : "border-ui-accent/25 bg-ui-accent-soft text-ui-accent";

  return (
    <section className={`rounded-ui-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold tracking-wider uppercase">
        Next required step
      </p>
      <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
      <p className="mt-1.5 text-sm leading-6 opacity-80">{step.detail}</p>
    </section>
  );
}

export function SeoReadinessPanel({
  content,
  summary,
  internalLinkSuggestions,
  linkSuggestionMessage,
  onApplyInternalLinkSuggestion,
  onAddSuggestedBlock,
  onOpenSettings,
  mediaAssetCount,
}: {
  content: PageContent;
  summary: SeoReadinessSummary;
  internalLinkSuggestions: InternalLinkSuggestion[];
  linkSuggestionMessage: string | null;
  onApplyInternalLinkSuggestion: (suggestion: InternalLinkSuggestion) => void;
  onAddSuggestedBlock: (type: PageBlock["type"]) => void;
  onOpenSettings: (finding: SeoReadinessFinding) => void;
  mediaAssetCount: number;
}) {
  // Blockers now live in the dedicated, always-visible publish-blocker
  // checklist above (single source of truth). This list shows the non-blocking
  // improvements only, so the same issue never appears in two panels.
  const topFindings = [...summary.warnings, ...summary.opportunities].slice(
    0,
    6,
  );
  // N19 / I20 item 8: non-blocking thin-page advisory (not a readiness rule).
  const thinWarning = thinPageWarning(content);

  return (
    <section className="flex flex-col gap-6">
      {thinWarning ? (
        <div
          role="status"
          className="rounded-ui-lg border-ui-warn/25 bg-ui-warn-fill text-ui-warn-ink flex items-start gap-2.5 border px-4 py-3 text-sm"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 size-4 shrink-0"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <span>{thinWarning}</span>
        </div>
      ) : null}
      <div className="bg-ui-line rounded-ui-lg border-ui-line shadow-ui grid gap-px overflow-hidden border sm:grid-cols-2">
        {summary.categories.map((category) => (
          <div
            key={category.category}
            className={`hover:bg-ui-canvas bg-ui-surface p-5 transition-colors ${readinessCategoryClass(
              category.status,
            )}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-ui-text text-sm font-semibold">
                {friendlyReadinessCategoryLabel(category.category)}
              </span>
              <span
                className={`rounded-ui px-2.5 py-0.5 text-xs font-semibold ${readinessPillClass(
                  category.status,
                )} ring-1 ring-black/5 ring-inset`}
              >
                {labelForReadinessStatus(category.status)}
              </span>
            </div>
            {category.findings[0] ? (
              <p className="text-ui-text-subtle mt-3 line-clamp-2 text-sm">
                {category.findings[0].message}
              </p>
            ) : (
              <p className="text-ui-text-subtle mt-3 flex items-center gap-1.5 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-ui-ok"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Evidence looks clean.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <div className="border-ui-line flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <h3 className="text-ui-text text-base font-semibold">Action Items</h3>
          <span className="text-ui-text-subtle text-sm font-medium">
            Highest impact first
          </span>
        </div>

        {topFindings.length > 0 ? (
          <div className="grid gap-4">
            {topFindings.map((finding, index) => (
              <article
                key={`${finding.code}-${finding.path}-${index}`}
                className="group border-ui-line hover:border-ui-line-strong rounded-ui-lg bg-ui-surface shadow-ui hover:shadow-ui-raised relative flex flex-col border p-5 transition-all"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`size-2.5 rounded-full ${findingDotClass(
                      finding.severity,
                    )}`}
                  />
                  <span className="text-ui-text-subtle text-xs font-bold tracking-wider uppercase">
                    {findingSeverityLabel(finding.severity)}
                  </span>
                  <span className="bg-ui-canvas text-ui-text-muted rounded-ui ring-ui-line px-2 py-1 text-xs font-medium ring-1 ring-inset">
                    {friendlyFindingLocation(finding)}
                  </span>
                </div>
                <p className="text-ui-text mt-3 text-sm leading-6 font-semibold">
                  {finding.message}
                </p>
                {friendlyEvidenceText(finding) && (
                  <p className="text-ui-text-subtle mt-1.5 text-sm">
                    {friendlyEvidenceText(finding)}
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <ReadinessFindingAction
                    content={content}
                    finding={finding}
                    onAddSuggestedBlock={onAddSuggestedBlock}
                    onOpenSettings={onOpenSettings}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-ui-lg border-ui-ok/25 bg-ui-ok-fill text-ui-ok-ink shadow-ui mt-3 border px-6 py-8 text-center text-sm leading-6">
            <div className="bg-ui-ok-fill text-ui-ok mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
              </svg>
            </div>
            <h4 className="text-ui-ok-ink text-sm font-semibold">All clear!</h4>
            <p className="text-ui-ok-ink mt-1 text-sm">
              No readiness findings on this draft. Review the public preview
              before publishing.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="border-ui-line rounded-ui-lg bg-ui-surface shadow-ui hover:shadow-ui-raised border p-5 transition-shadow">
          <h3 className="text-ui-text text-sm font-semibold">
            Builder support
          </h3>
          <div className="mt-4 grid gap-3">
            <details className="border-ui-line bg-ui-canvas text-ui-text rounded-ui-lg border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold">
                Media assets
              </summary>
              <p className="text-ui-text-subtle mt-2 text-xs leading-5">
                {mediaAssetCount > 0
                  ? `${mediaAssetCount} approved assets are available from image blocks.`
                  : "No assets yet. Add images, alt text, and rights notes before relying on image blocks."}
              </p>
              <Link
                href="/admin/media"
                className="text-ui-accent hover:text-ui-text mt-3 inline-flex text-xs font-semibold"
              >
                Open full media library
              </Link>
            </details>
            <details className="border-ui-line bg-ui-canvas text-ui-text rounded-ui-lg border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold">
                Approved claims and CTAs
              </summary>
              <p className="text-ui-text-subtle mt-2 text-xs leading-5">
                Use content libraries for approved source excerpts, proof
                points, claims, and reusable CTA presets. Keep claims
                source-backed before adding them to this draft.
              </p>
              <Link
                href="/admin/libraries"
                className="text-ui-accent hover:text-ui-text mt-3 inline-flex text-xs font-semibold"
              >
                Open content libraries
              </Link>
            </details>
          </div>
        </div>
      </div>

      {(internalLinkSuggestions.length > 0 || linkSuggestionMessage) && (
        <div className="rounded-ui-lg border-ui-accent/25 bg-ui-accent-soft shadow-ui mb-6 border p-5">
          <div className="border-ui-accent/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-ui-accent flex items-center gap-2 text-sm font-semibold">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Internal link suggestions
              </h3>
              <p className="text-ui-accent mt-1 text-xs">
                Add relevant links from the copy that already exists on this
                page.
              </p>
            </div>
            <span className="rounded-ui bg-ui-surface text-ui-accent shadow-ui ring-ui-accent/25 px-3 py-1 text-xs font-semibold ring-1 ring-inset">
              {internalLinkSuggestions.length} available
            </span>
          </div>

          {linkSuggestionMessage && (
            <p className="text-ui-text-muted rounded-ui-lg bg-ui-surface shadow-ui ring-ui-accent/25 mt-4 px-4 py-3 text-sm font-medium ring-1 ring-inset">
              {linkSuggestionMessage}
            </p>
          )}

          {internalLinkSuggestions.length > 0 && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {internalLinkSuggestions.slice(0, 4).map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="group rounded-ui-lg bg-ui-surface shadow-ui ring-ui-accent/25 hover:shadow-ui-raised hover:ring-ui-accent/25 flex flex-col p-4 ring-1 transition-all ring-inset"
                >
                  <p className="text-ui-text text-sm font-semibold">
                    Link &quot;{suggestion.anchorText}&quot;
                  </p>
                  <p className="text-ui-text-subtle mt-1.5 line-clamp-2 text-xs">
                    {suggestion.reason}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="text-ui-accent truncate text-xs font-medium">
                      {suggestion.targetPath}
                    </span>
                    <button
                      type="button"
                      className="rounded-ui-lg bg-ui-surface text-ui-accent shadow-ui ring-ui-accent/25 hover:bg-ui-accent-soft focus-visible:ring-ui-accent px-3 py-1.5 text-xs font-semibold ring-1 transition-all ring-inset focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() => onApplyInternalLinkSuggestion(suggestion)}
                    >
                      Apply link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReadinessFindingAction({
  content,
  finding,
  onAddSuggestedBlock,
  onOpenSettings,
}: {
  content: PageContent;
  finding: SeoReadinessFinding;
  onAddSuggestedBlock: (type: PageBlock["type"]) => void;
  onOpenSettings: (finding: SeoReadinessFinding) => void;
}) {
  const suggestedBlock = suggestedBlockForFinding(finding);
  const anchor = anchorForFinding(content, finding);

  if (suggestedBlock) {
    return (
      <button
        type="button"
        className={smallButtonClass}
        onClick={() => onAddSuggestedBlock(suggestedBlock.type)}
      >
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          {suggestedBlock.label}
        </span>
      </button>
    );
  }

  if (requiresSeoSettings(finding)) {
    return (
      <button
        type="button"
        className={smallButtonClass}
        onClick={() => onOpenSettings(finding)}
      >
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Open SEO settings
        </span>
      </button>
    );
  }

  if (anchor) {
    return (
      <a href={anchor} className={smallButtonClass}>
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" x2="21" y1="14" y2="3" />
          </svg>
          Go to field
        </span>
      </a>
    );
  }

  return (
    <span className="bg-ui-canvas text-ui-text-subtle rounded-ui ring-ui-line inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ring-1 ring-inset">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      Review the highlighted area in the editor
    </span>
  );
}
