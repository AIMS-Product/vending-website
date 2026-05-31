"use client";

import { useMemo, useState } from "react";
import type { PageAiProposalInsertResult } from "@/app/admin/pages/actions";
import type { AiPageProposalReview } from "@/lib/services/ai-page-proposals";
import {
  aiBlockReviewBody,
  aiBlockReviewTitle,
  blockLabel,
} from "@/lib/page-builder/editor-helpers";
import { miniButtonClass } from "@/components/admin/seo-page-editor/editor-styles";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

// The generative SEO agent lives in its own floating surface so the right
// sidebar stays purely SEO configuration + publish, and structure mutation
// never originates from the readiness panel. The launcher is offset on desktop
// when the SEO panel is open so it never covers the sticky Publish footer.
export function AiBuilderAssistant({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const canRunAiAgent = Boolean(editor.page?.id);
  const seoPanelOpenOnDesktop =
    !editor.isNarrowEditor && !editor.isSeoSidebarCollapsed;
  const offsetClass = seoPanelOpenOnDesktop ? "xl:right-[28rem]" : "";
  const pendingCount = editor.aiProposals.filter(
    (proposal) => proposal.status === "proposed",
  ).length;

  return (
    <>
      {isOpen && (
        <section
          aria-label="AI page builder assistant"
          className={`fixed right-4 bottom-24 z-[70] flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl ${offsetClass}`}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-100 bg-violet-50 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                <SparkIcon />
                SEO agent
              </h2>
              <p className="mt-1 text-xs text-violet-700">
                Source-backed drafts stay separate until you insert selected
                content into the page.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close AI assistant"
              className="rounded-lg p-1 text-violet-500 transition hover:bg-violet-100 hover:text-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              onClick={() => setIsOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <button
              type="button"
              className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canRunAiAgent || editor.isAiGenerating}
              onClick={() => {
                void editor.runAiSeoAgent();
              }}
            >
              {editor.isAiGenerating
                ? "Running..."
                : canRunAiAgent
                  ? "Run SEO agent"
                  : "Save the page first"}
            </button>

            {editor.aiProposalResult.status !== "idle" &&
              editor.aiProposalResult.message && (
                <p
                  className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ring-1 ring-inset ${
                    editor.aiProposalResult.status === "error"
                      ? "bg-red-50 text-red-700 ring-red-200"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }`}
                >
                  {editor.aiProposalResult.message}
                </p>
              )}

            <AiProposalReviewList
              proposals={editor.aiProposals}
              insertResult={editor.aiInsertResult}
              isInserting={editor.isAiInserting}
              onInsertBlocks={editor.insertAiProposalBlocks}
            />
          </div>
        </section>
      )}

      <button
        type="button"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={isOpen}
        className={`fixed right-4 bottom-6 z-[70] inline-flex items-center gap-2 rounded-full border border-violet-400 bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:outline-none ${offsetClass}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <SparkIcon />
        <span>AI</span>
        {!isOpen && pendingCount > 0 && (
          <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-violet-700">
            {pendingCount}
          </span>
        )}
      </button>
    </>
  );
}

function SparkIcon() {
  return (
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
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function CloseIcon() {
  return (
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
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

type AiReviewProposedBlock = AiPageProposalReview["proposal"]["blocks"][number];

function AiProposalReviewList({
  proposals,
  insertResult,
  isInserting,
  onInsertBlocks,
}: {
  proposals: AiPageProposalReview[];
  insertResult: PageAiProposalInsertResult;
  isInserting: boolean;
  onInsertBlocks: (proposalId: string, blockIds: string[]) => void;
}) {
  if (proposals.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-violet-200 bg-violet-50/60 px-4 py-6 text-center text-sm leading-6 text-violet-700">
        No proposals yet. Run the SEO agent to generate source-backed draft
        blocks you can review and insert.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {proposals.slice(0, 3).map((proposal) => (
        <AiProposalReviewCard
          key={proposal.id}
          proposal={proposal}
          insertResult={insertResult}
          isInserting={isInserting}
          onInsertBlocks={onInsertBlocks}
        />
      ))}
    </div>
  );
}

function AiProposalReviewCard({
  proposal,
  insertResult,
  isInserting,
  onInsertBlocks,
}: {
  proposal: AiPageProposalReview;
  insertResult: PageAiProposalInsertResult;
  isInserting: boolean;
  onInsertBlocks: (proposalId: string, blockIds: string[]) => void;
}) {
  const defaultSelectedBlockIds = useMemo(
    () =>
      proposal.proposal.blocks.flatMap((entry) =>
        canInsertAiProposedBlock(entry) ? [entry.block.id] : [],
      ),
    [proposal],
  );
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>(
    defaultSelectedBlockIds,
  );
  const proposalResult =
    insertResult.proposalId === proposal.id ? insertResult : null;
  const isProposed = proposal.status === "proposed";
  const selectableCount = defaultSelectedBlockIds.length;
  const sourceRefCount = proposal.proposal.blocks.reduce(
    (count, entry) => count + aiSourceCount(entry),
    0,
  );
  const warningCount =
    proposal.warnings.length +
    proposal.proposal.blocks.reduce(
      (count, entry) => count + entry.warnings.length,
      0,
    );

  return (
    <article className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-violet-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-950">
              AI proposal
            </h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {isProposed ? "Ready" : proposal.status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {isProposed
              ? "Review selected content before inserting it into the page."
              : "Already accepted. Check the editor below for duplicate or outdated sections before publishing."}
          </p>
        </div>
        {isProposed && (
          <button
            type="button"
            className={miniButtonClass}
            disabled={isInserting || selectedBlockIds.length === 0}
            onClick={() => onInsertBlocks(proposal.id, selectedBlockIds)}
          >
            {isInserting ? "Inserting..." : "Insert selected content"}
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">
            {proposal.proposal.blocks.length}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Items</p>
        </div>
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">
            {sourceRefCount}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Sources</p>
        </div>
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">{warningCount}</p>
          <p className="text-[11px] font-medium text-slate-500">Warnings</p>
        </div>
      </div>

      {proposal.proposal.metadata.seoTitle && (
        <p className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
          SEO title suggestion:{" "}
          <span className="font-semibold text-slate-800">
            {proposal.proposal.metadata.seoTitle}
          </span>
        </p>
      )}

      {proposalResult?.message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ring-1 ${
            proposalResult.status === "error"
              ? "bg-red-50 text-red-700 ring-red-100"
              : "bg-emerald-50 text-emerald-700 ring-emerald-100"
          }`}
        >
          {proposalResult.message}
        </p>
      )}

      <details className="mt-3 rounded-md border border-violet-100 bg-violet-50/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
          Review content changes · {selectableCount} safe to insert
        </summary>
        <div className="grid gap-2 border-t border-violet-100 p-2">
          {proposal.proposal.blocks.map((entry) => {
            const canInsert = canInsertAiProposedBlock(entry);
            const checked = selectedBlockIds.includes(entry.block.id);
            return (
              <label
                key={entry.block.id}
                className={`flex gap-3 rounded-md border p-3 text-left ${
                  canInsert && isProposed
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-100 bg-slate-50/60 text-slate-400"
                }`}
              >
                <input
                  aria-label={`Insert ${aiBlockReviewTitle(entry.block)}`}
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={!canInsert || !isProposed || isInserting}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setSelectedBlockIds((current) =>
                      nextChecked
                        ? [...new Set([...current, entry.block.id])]
                        : current.filter((id) => id !== entry.block.id),
                    );
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {blockLabel(entry.block.type)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                      {aiSourceCount(entry)} source refs
                    </span>
                  </span>
                  <span className="mt-1 block text-sm font-medium text-slate-800">
                    {aiBlockReviewTitle(entry.block)}
                  </span>
                  {aiBlockReviewBody(entry.block) && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
                      {aiBlockReviewBody(entry.block)}
                    </span>
                  )}
                  {entry.warnings.length > 0 && (
                    <span className="mt-2 block text-xs leading-5 text-amber-700">
                      {entry.warnings
                        .map((warning) => warning.message)
                        .join(" ")}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </details>

      {proposal.warnings.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
          {proposal.warnings.map((warning) => warning.message).join(" ")}
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-400">
          Technical reference
        </summary>
        <p className="mt-1 font-mono text-[11px] break-all text-slate-400">
          {proposal.id}
        </p>
      </details>
    </article>
  );
}

function canInsertAiProposedBlock(entry: AiReviewProposedBlock) {
  return (
    aiSourceCount(entry) > 0 &&
    !entry.warnings.some(
      (warning) =>
        warning.code === "unsupported_claim" || warning.code === "needs_source",
    )
  );
}

function aiSourceCount(entry: AiReviewProposedBlock) {
  return (
    entry.sourceDocumentIds.length +
    entry.sourceExcerptIds.length +
    entry.approvedClaimIds.length
  );
}
