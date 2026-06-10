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
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : step.tone === "blocked"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-sky-200 bg-sky-50 text-sky-950";

  return (
    <section className={`rounded-xl border p-4 ${toneClass}`}>
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

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 shadow-sm sm:grid-cols-2">
        {summary.categories.map((category) => (
          <div
            key={category.category}
            className={`bg-white p-5 transition-colors hover:bg-slate-50 ${readinessCategoryClass(
              category.status,
            )}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {friendlyReadinessCategoryLabel(category.category)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${readinessPillClass(
                  category.status,
                )} ring-1 ring-black/5 ring-inset`}
              >
                {labelForReadinessStatus(category.status)}
              </span>
            </div>
            {category.findings[0] ? (
              <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                {category.findings[0].message}
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-400">
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
                  className="text-emerald-500"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold text-slate-900">
            Action Items
          </h3>
          <span className="text-sm font-medium text-slate-500">
            Highest impact first
          </span>
        </div>

        {topFindings.length > 0 ? (
          <div className="grid gap-4">
            {topFindings.map((finding, index) => (
              <article
                key={`${finding.code}-${finding.path}-${index}`}
                className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`size-2.5 rounded-full ${findingDotClass(
                      finding.severity,
                    )}`}
                  />
                  <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    {findingSeverityLabel(finding.severity)}
                  </span>
                  <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 ring-inset">
                    {friendlyFindingLocation(finding)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 font-semibold text-slate-900">
                  {finding.message}
                </p>
                {friendlyEvidenceText(finding) && (
                  <p className="mt-1.5 text-sm text-slate-500">
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
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center text-sm leading-6 text-emerald-800 shadow-sm">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
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
            <h4 className="text-sm font-semibold text-emerald-900">
              All clear!
            </h4>
            <p className="mt-1 text-sm text-emerald-700">
              No readiness findings on this draft. Review the public preview
              before publishing.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="text-sm font-semibold text-slate-900">
            Builder support
          </h3>
          <div className="mt-4 grid gap-3">
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <summary className="cursor-pointer font-semibold">
                Media assets
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {mediaAssetCount > 0
                  ? `${mediaAssetCount} approved assets are available from image blocks.`
                  : "No assets yet. Add images, alt text, and rights notes before relying on image blocks."}
              </p>
              <Link
                href="/admin/media"
                className="mt-3 inline-flex text-xs font-semibold text-[#0b63f6] hover:text-slate-950"
              >
                Open full media library
              </Link>
            </details>
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <summary className="cursor-pointer font-semibold">
                Approved claims and CTAs
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Use content libraries for approved source excerpts, proof
                points, claims, and reusable CTA presets. Keep claims
                source-backed before adding them to this draft.
              </p>
              <Link
                href="/admin/libraries"
                className="mt-3 inline-flex text-xs font-semibold text-[#0b63f6] hover:text-slate-950"
              >
                Open content libraries
              </Link>
            </details>
          </div>
        </div>
      </div>

      {(internalLinkSuggestions.length > 0 || linkSuggestionMessage) && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/60 pb-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-900">
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
              <p className="mt-1 text-xs text-sky-700">
                Add relevant links from the copy that already exists on this
                page.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm ring-1 ring-sky-200 ring-inset">
              {internalLinkSuggestions.length} available
            </span>
          </div>

          {linkSuggestionMessage && (
            <p className="mt-4 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-sky-200 ring-inset">
              {linkSuggestionMessage}
            </p>
          )}

          {internalLinkSuggestions.length > 0 && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {internalLinkSuggestions.slice(0, 4).map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="group flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-sky-200 transition-all ring-inset hover:shadow-md hover:ring-sky-300"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    Link &quot;{suggestion.anchorText}&quot;
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                    {suggestion.reason}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="truncate text-xs font-medium text-sky-700">
                      {suggestion.targetPath}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm ring-1 ring-sky-300 transition-all ring-inset hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
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
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 ring-inset">
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
