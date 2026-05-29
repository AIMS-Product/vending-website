"use client";

import {
  NextPublishStepCard,
  SeoReadinessPanel,
} from "@/components/admin/seo-page-editor/SeoReadinessPanel";
import {
  compactInputClass,
  primaryButtonClass,
  readinessButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  textareaClass,
} from "@/components/admin/seo-page-editor/editor-styles";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

export function SeoPublishPanel({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  return (
    <section
      aria-labelledby="seo-panel-title"
      className="fixed top-32 right-4 bottom-4 z-[60] order-3 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl xl:sticky xl:top-4 xl:right-auto xl:bottom-auto xl:z-auto xl:order-none xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:w-auto xl:max-w-none"
    >
      <SeoPanelHeader editor={editor} />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <PublishStatusCard editor={editor} />
        <NextPublishStepCard step={editor.nextPublishStep} />
        <SeoMetadataFields editor={editor} />
        <SeoReadinessPanel
          content={editor.content}
          summary={editor.seoReadiness}
          aiProposalResult={editor.aiProposalResult}
          aiInsertResult={editor.aiInsertResult}
          aiProposals={editor.aiProposals}
          canRunAiAgent={Boolean(editor.page?.id)}
          isAiGenerating={editor.isAiGenerating}
          isAiInserting={editor.isAiInserting}
          internalLinkSuggestions={editor.internalLinkSuggestions}
          linkSuggestionMessage={editor.linkSuggestionMessage}
          onInsertAiProposalBlocks={editor.insertAiProposalBlocks}
          onApplyInternalLinkSuggestion={editor.applyLinkSuggestion}
          onAddSuggestedBlock={editor.addSuggestedBlock}
          onRunAiAgent={editor.runAiSeoAgent}
          onOpenSettings={editor.focusSeoTargetKeyword}
          mediaAssetCount={editor.mediaAssets.length}
        />
      </div>
      <SeoPublishActions editor={editor} />
    </section>
  );
}

function SeoPanelHeader({ editor }: { editor: SeoPageEditorController }) {
  const { publishStateLabel, seoReadiness } = editor;

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div>
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          SEO
        </p>
        <h2
          id="seo-panel-title"
          className="mt-1 text-base font-semibold text-slate-950"
        >
          Readiness and publish
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-500">
          {publishStateLabel} · SEO {seoReadiness.label}
        </p>
      </div>
      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
        {seoReadiness.label}
      </span>
    </div>
  );
}

function PublishStatusCard({ editor }: { editor: SeoPageEditorController }) {
  const { focusSeoTargetKeyword, page, publishStateHelp, publishStateLabel } =
    editor;

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Status
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                page?.status === "published" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {publishStateLabel}
          </span>
        </span>
      </div>
      <p className="text-xs leading-5 font-medium text-slate-500">
        {publishStateHelp}
      </p>
      <dl className="grid gap-1.5 text-xs text-slate-500">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium">Last updated</dt>
          <dd className="font-semibold text-slate-700">
            {page?.updated_at ? formatPanelDate(page.updated_at) : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium">Published</dt>
          <dd className="font-semibold text-slate-700">
            {page?.published_at
              ? formatPanelDate(page.published_at)
              : "Not yet"}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className={`${smallButtonClass} ${readinessButtonClass(
          editor.seoReadiness.status,
        )} justify-center`}
        onClick={focusSeoTargetKeyword}
      >
        SEO: {editor.seoReadiness.label}
      </button>
    </div>
  );
}

function formatPanelDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SeoMetadataFields({ editor }: { editor: SeoPageEditorController }) {
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Page title</span>
        <input
          name="title"
          aria-label="Page title"
          value={editor.title}
          id="page-title-field"
          onChange={(event) => editor.setTitle(event.target.value)}
          required
          className={compactInputClass}
          placeholder="Internal page title and SEO fallback"
        />
        <span className="mt-1.5 block text-xs leading-5 text-slate-500">
          Used for admin lists, slug generation, and as the SEO title fallback.
          The visible page headline is edited in the hero block.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Slug</span>
        <div className="mt-1.5 flex items-center rounded-lg border border-slate-200 bg-white shadow-sm transition focus-within:border-[#0b63f6] focus-within:ring-4 focus-within:ring-[#0b63f6]/10">
          <span className="border-r border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600">
            /resources/
          </span>
          <input
            name="slug"
            value={editor.visibleSlug}
            onChange={(event) => editor.updateSlugFromInput(event.target.value)}
            required
            aria-label="Slug"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
            placeholder="page-slug"
          />
        </div>
      </label>

      <TextInput
        name="targetKeyword"
        label="Target keyword"
        value={editor.targetKeyword}
        id="seo-target-keyword-field"
        onChange={editor.setTargetKeyword}
        placeholder="e.g. vending machine business"
      />
      <TextInput
        name="seoTitle"
        label="SEO title"
        value={editor.seoTitle}
        id="seo-title-field"
        onChange={editor.setSeoTitle}
        placeholder="Leave blank to use page headline"
      />

      <label className="block">
        <span className="text-sm font-semibold text-slate-900">
          Meta description
        </span>
        <textarea
          name="metaDescription"
          aria-label="Meta description"
          value={editor.metaDescription}
          id="page-meta-description-field"
          onChange={(event) => editor.setMetaDescription(event.target.value)}
          rows={3}
          className={textareaClass}
          placeholder="Search result summary for this page."
        />
      </label>

      <AdvancedSeoFields editor={editor} />
      <SearchPreviewCard editor={editor} />
    </div>
  );
}

function TextInput({
  id,
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <input
        name={name}
        aria-label={label}
        value={value}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        className={compactInputClass}
        placeholder={placeholder}
      />
    </label>
  );
}

function AdvancedSeoFields({ editor }: { editor: SeoPageEditorController }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Advanced SEO
      </summary>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">
            Preferred URL
          </span>
          <input
            name="canonicalUrl"
            aria-label="Preferred URL"
            value={editor.canonicalUrl}
            id="seo-canonical-url-field"
            onChange={(event) => editor.setCanonicalUrl(event.target.value)}
            className={compactInputClass}
            placeholder="https://..."
          />
          <span className="mt-1.5 block text-xs leading-5 text-slate-500">
            Optional. Use only when this page should point search engines to a
            different preferred URL.
          </span>
        </label>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <CheckboxSetting
            checked={editor.noindex}
            label="Hide from search engines"
            name="noindex"
            onChange={(checked) => {
              editor.setNoindex(checked);
              if (checked) editor.setSitemapEnabled(false);
            }}
            help="Use this only for pages that should not appear in search results."
          />
          <CheckboxSetting
            checked={editor.sitemapEnabled}
            disabled={editor.noindex}
            label="Include in sitemap"
            name="sitemapEnabled"
            onChange={editor.setSitemapEnabled}
            help="Help search engines discover this page."
          />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Structured data
            </p>
            <p className="mt-0.5 text-xs leading-5 font-normal text-slate-500">
              Control the search metadata generated from this published page.
            </p>
          </div>
          <CheckboxSetting
            checked={editor.structuredDataBreadcrumb}
            label="Breadcrumb trail"
            name="structuredDataBreadcrumb"
            onChange={editor.setStructuredDataBreadcrumb}
            help="Add page path context for search engines."
          />
          <CheckboxSetting
            checked={editor.structuredDataFaq}
            label="Visible FAQs"
            name="structuredDataFaq"
            onChange={editor.setStructuredDataFaq}
            help="Generate FAQ metadata only from published FAQ blocks."
          />
        </div>
      </div>
    </details>
  );
}

function CheckboxSetting({
  checked,
  disabled = false,
  help,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  help: string;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-700">
      <input
        name={name}
        aria-label={label}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 rounded border-slate-300 text-[#0b63f6] focus:ring-[#0b63f6] disabled:opacity-50"
      />
      <div className={disabled ? "opacity-50" : ""}>
        <span className="block text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs font-normal text-slate-500">
          {help}
        </span>
      </div>
    </label>
  );
}

function SearchPreviewCard({ editor }: { editor: SeoPageEditorController }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-center gap-2">
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
          className="text-[#0b63f6]"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-900">Search Preview</h3>
      </div>
      <div className="space-y-1">
        <p className="cursor-pointer truncate text-lg font-medium text-[#1a0dab] hover:underline">
          {editor.seoTitle || editor.title || "Your Page Title Here"}
        </p>
        <p className="truncate text-sm text-[#006621]">
          www.vendingpreneurs.com/resources/
          {editor.visibleSlug || "your-slug"}
        </p>
        <p className="line-clamp-2 text-sm text-[#545454]">
          {editor.metaDescription ||
            "Your meta description will appear here. Make it compelling to encourage clicks from search results."}
        </p>
      </div>
    </div>
  );
}

function SeoPublishActions({ editor }: { editor: SeoPageEditorController }) {
  return (
    <div className="grid shrink-0 gap-4 border-t border-slate-200 bg-white p-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-5">
      <button
        type="submit"
        className={secondaryButtonClass}
        name="intent"
        value="save"
        title={
          editor.isPublishedPage
            ? "Save unpublished edits while keeping the current live page published."
            : undefined
        }
      >
        {editor.saveDraftLabel}
      </button>
      <button
        type="submit"
        className={primaryButtonClass}
        name="intent"
        value="publish"
        disabled={editor.publishDisabled}
        title={
          editor.seoReadiness.blockers.length > 0
            ? "Resolve SEO blockers before publishing."
            : undefined
        }
      >
        {editor.publishButtonLabel}
      </button>
    </div>
  );
}
