"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import type {
  PageBlock,
  PageChromeSettings,
  QualificationAttachmentSettings,
} from "@/lib/page-builder/blocks";
import type { BlockVariant } from "@/lib/page-builder/block-options";
import type { MoveDirection } from "@/lib/page-builder/editor-state";
import {
  type SavedPageTemplateOption,
  type PageTypeId,
  type PageTypeOption,
} from "@/lib/page-builder/page-templates";
import {
  blockLabel,
  blockSummary,
  completionMessagesForBlock,
  type BuilderBlockEntry,
} from "@/lib/page-builder/editor-helpers";
import { adminEyebrowClass, adminPanelClass } from "@/components/admin/AdminUi";
import {
  BuilderGlyph,
  SettingsGlyph,
} from "@/components/admin/seo-page-editor/BuilderEditorUi";
import { BlockPicker } from "@/components/admin/seo-page-editor/BlockPicker";
import { TextInput } from "@/components/admin/seo-page-editor/EditorInputs";
import { footerColumns, primaryNav } from "@/lib/content/nav";

// N13 / issue I15: a single-step create panel. The old 3-step wizard forced
// two "Continue" clicks plus a review screen for effectively one real choice
// (page type — the "starting point" step only ever offered Blank unless saved
// templates existed). This collapses everything into one screen: pick a page
// type and start building. The optional saved-template chooser is still shown
// inline when templates exist for the selected type, so no previously
// collectable input is lost; otherwise it defaults to a blank canvas. Every
// other field (title, slug, SEO, blocks) is set in the editor afterward, as
// before. onChoosePageTemplate is unchanged — only how we reach it changed.
export function NewPageChoiceGate({
  pageTypeOptions,
  savedTemplates = [],
  onChoosePageTemplate,
}: {
  pageTypeOptions: readonly PageTypeOption[];
  savedTemplates?: readonly SavedPageTemplateOption[];
  onChoosePageTemplate: (pageType: string, templateKey: string) => void;
}) {
  const [selectedPageType, setSelectedPageType] =
    useState<PageTypeId>("resource");
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState<
    string | null
  >(null);

  const templatesForPageType = useMemo(
    () =>
      savedTemplates.filter(
        (template) => template.pageType === selectedPageType,
      ),
    [savedTemplates, selectedPageType],
  );
  const hasSavedTemplates = templatesForPageType.length > 0;
  const selectedSavedTemplate =
    templatesForPageType.find(
      (template) => template.id === selectedSavedTemplateId,
    ) ?? null;

  function selectPageType(nextPageType: PageTypeId) {
    setSelectedPageType(nextPageType);
    // Reset any template selection that no longer applies to the new type.
    setSelectedSavedTemplateId(null);
  }

  function handleStartBuilding() {
    const templateKey = selectedSavedTemplate?.templateKey ?? "blank";
    onChoosePageTemplate(selectedPageType, templateKey);
  }

  return (
    <div className="border-ui-line bg-ui-canvas grid min-h-[calc(100dvh-4rem)] place-items-center border px-4 py-8">
      {/* C132: a plain <div>, not a named <section>. AdminShell already wraps
          this route in a `region` landmark (<section aria-labelledby="admin-shell-title">),
          so adding a second named region here nested inside it tripped axe's
          landmark-unique rule. The heading below keeps the panel's structure. */}
      <div className="border-ui-line rounded-ui-lg bg-ui-surface shadow-ui-raised w-full max-w-3xl border p-5 sm:p-8">
        <div className="mb-6">
          <p className="text-ui-accent text-xs font-semibold tracking-wider uppercase">
            SEO Page Builder
          </p>
          <h2
            id="new-page-choice-title"
            className="text-ui-text mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Create page
          </h2>
          <p className="text-ui-text-muted mt-2 max-w-xl text-sm leading-6">
            Choose the page type that best matches your goal, then start
            building. You can adjust every detail in the editor.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-ui-text text-sm font-semibold">
            What kind of page are you creating?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {pageTypeOptions.map((option) => {
              const isSelected = option.id === selectedPageType;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`focus-visible:ring-ui-accent/20 rounded-ui-lg border p-4 text-left transition focus-visible:ring-4 focus-visible:outline-none ${
                    isSelected
                      ? "border-ui-accent bg-ui-accent-soft shadow-ui"
                      : "border-ui-line hover:border-ui-line-strong bg-ui-surface"
                  }`}
                  aria-pressed={isSelected}
                  onClick={() => selectPageType(option.id)}
                >
                  <span className="text-ui-text block text-sm font-semibold">
                    {option.label}
                  </span>
                  <span className="text-ui-text-muted mt-1 block text-sm leading-5">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {hasSavedTemplates ? (
          <fieldset className="mt-6 space-y-3">
            <legend className="text-ui-text text-sm font-semibold">
              Start from a template (optional)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                label="Blank page"
                description="Start with an empty editable canvas."
                selected={selectedSavedTemplateId === null}
                onClick={() => setSelectedSavedTemplateId(null)}
              />
              {templatesForPageType.map((template) => (
                <ChoiceCard
                  key={template.id}
                  label={template.label}
                  description={template.description}
                  selected={template.id === selectedSavedTemplateId}
                  onClick={() => setSelectedSavedTemplateId(template.id)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="border-ui-line mt-8 flex justify-end border-t pt-6">
          <button
            type="button"
            className="border-ui-accent bg-ui-accent focus-visible:ring-ui-accent/20 hover:bg-ui-accent-hover rounded-ui shadow-ui min-h-11 border px-5 text-sm font-semibold text-white transition focus-visible:ring-4 focus-visible:outline-none"
            onClick={handleStartBuilding}
          >
            Start building page
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  label,
  description,
  selected,
  disabled = false,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`focus-visible:ring-ui-accent/20 rounded-ui-lg border p-4 text-left transition focus-visible:ring-4 focus-visible:outline-none ${
        disabled
          ? "border-ui-line bg-ui-canvas cursor-not-allowed opacity-70"
          : selected
            ? "border-ui-accent bg-ui-accent-soft shadow-ui"
            : "border-ui-line hover:border-ui-line-strong bg-ui-surface"
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="text-ui-text block text-sm font-semibold">{label}</span>
      <span className="text-ui-text-muted mt-1 block text-sm leading-5">
        {description}
      </span>
    </button>
  );
}

export function EditorPublicHeader() {
  return (
    <header className="sticky inset-x-0 top-0 z-20 border-b-2 border-[#111111] bg-[#f5fbff]/95 backdrop-blur-md">
      {/* N17 / I12: this header is an inert preview of the public site chrome
          (its links preventDefault and go nowhere). Keep it out of the keyboard
          tab order so the real SEO fields are reachable early — the links are
          decorative here, not navigable. */}
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-8 px-5 py-4 lg:px-10">
        <Link
          href="/"
          aria-label="Vendingpreneurs home (preview)"
          tabIndex={-1}
          onClick={(event) => event.preventDefault()}
        >
          <Wordmark height={48} />
        </Link>
        <nav
          aria-label="Primary"
          className="hidden items-center gap-x-10 lg:flex"
        >
          {primaryNav.map((item) => (
            <EditorPublicNavLink key={item.label} item={item} />
          ))}
        </nav>
        <Link
          href="/contact"
          tabIndex={-1}
          onClick={(event) => event.preventDefault()}
          className="hidden min-h-12 items-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] lg:inline-flex"
        >
          Step inside
        </Link>
      </div>
    </header>
  );
}

export function EditorPublicFooter() {
  return (
    <footer className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-14 lg:px-10">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
        <Wordmark />
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-4"
        >
          {footerColumns.map((col, columnIndex) => (
            <ul
              key={col.items[0]?.label ?? "footer-column"}
              className="space-y-3"
            >
              {col.items.map((item) => (
                <li key={item.label}>
                  <EditorPublicNavLink
                    item={item}
                    highlighted={columnIndex === footerColumns.length - 1}
                  />
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function EditorPublicNavLink({
  item,
  highlighted = false,
}: {
  item:
    | (typeof primaryNav)[number]
    | (typeof footerColumns)[number]["items"][number];
  highlighted?: boolean;
}) {
  const className = `text-sm font-black uppercase transition hover:text-[#066a99] ${
    highlighted ? "text-[#066a99]" : "text-[#111111]"
  }`;

  if (item.external) {
    return (
      <span className={className} aria-disabled="true">
        {item.label}
      </span>
    );
  }

  return (
    <span className={className} aria-disabled="true">
      {item.label}
    </span>
  );
}

export function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      {direction === "left" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

export function BuilderBlockSidebar({
  entries,
  selectedEntry,
  onSelectBlock,
  onEditBlock,
  onCreateBlock,
  onCreateBlockAfter,
  onMoveBlock,
}: {
  entries: BuilderBlockEntry[];
  selectedEntry: BuilderBlockEntry | null;
  onSelectBlock: (entry: BuilderBlockEntry) => void;
  onEditBlock: (entry: BuilderBlockEntry) => void;
  onCreateBlock: () => void;
  onCreateBlockAfter: (
    entry: BuilderBlockEntry,
    type: PageBlock["type"],
    variant?: BlockVariant,
  ) => void;
  onMoveBlock: (entry: BuilderBlockEntry, direction: MoveDirection) => void;
}) {
  // Issue I4 / R3-5: moveBlock reorders within a column, so the up/down
  // boundaries are the first/last block of each column — count per column.
  const columnBlockCounts = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.sectionId}:${entry.columnId}`;
    columnBlockCounts.set(key, (columnBlockCounts.get(key) ?? 0) + 1);
  }

  return (
    <section className={adminPanelClass}>
      <div className="border-ui-line border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={adminEyebrowClass}>Page blocks</p>
            <h3 className="mt-1 text-base font-semibold">Builder outline</h3>
          </div>
          <span className="bg-ui-idle-fill text-ui-idle-ink rounded-ui px-2 py-0.5 text-xs font-semibold tabular-nums">
            {entries.length}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4">
        {entries.length > 0 ? (
          <div className="max-h-[calc(100dvh-18rem)] space-y-2 overflow-y-auto pr-1">
            {entries.map((entry) => {
              const isSelected = selectedEntry?.block.id === entry.block.id;
              const hasWarnings =
                completionMessagesForBlock(entry.block).length > 0;
              const columnBlockCount =
                columnBlockCounts.get(`${entry.sectionId}:${entry.columnId}`) ??
                1;
              const isFirstInColumn = entry.blockIndex === 0;
              const isLastInColumn = entry.blockIndex === columnBlockCount - 1;
              const moveButtonClass = `rounded-ui focus-visible:ring-ui-accent/30 text-ui-text-muted flex size-9 shrink-0 items-center justify-center transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 ${
                isSelected
                  ? "bg-ui-surface enabled:hover:bg-ui-canvas"
                  : "bg-ui-canvas enabled:hover:bg-ui-line"
              }`;

              return (
                <div
                  key={entry.block.id}
                  className={`rounded-ui-lg text-ui-text flex items-stretch gap-2 border p-1.5 transition ${
                    isSelected
                      ? "border-ui-accent/30 bg-ui-accent-soft"
                      : "border-ui-line bg-ui-surface hover:bg-ui-canvas"
                  }`}
                >
                  <button
                    type="button"
                    className="rounded-ui focus-visible:ring-ui-accent/30 flex min-w-0 flex-1 items-start gap-3 px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => onSelectBlock(entry)}
                  >
                    <span
                      className={`rounded-ui mt-0.5 flex size-9 shrink-0 items-center justify-center ring-1 ${
                        isSelected
                          ? "text-ui-accent bg-ui-surface ring-ui-accent/20"
                          : "bg-ui-canvas text-ui-text-muted ring-ui-line"
                      }`}
                      aria-hidden="true"
                    >
                      <BuilderGlyph name={entry.block.type} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {blockLabel(entry.block.type)}
                        </span>
                        {hasWarnings && (
                          <span className="bg-ui-warn size-2 rounded-full" />
                        )}
                      </span>
                      <span className="text-ui-text-subtle mt-1 line-clamp-2 block text-xs leading-5">
                        {entry.blockNumber}. {blockSummary(entry.block)}
                      </span>
                      <span className="text-ui-text-subtle mt-1 block text-[11px] font-medium">
                        Section {entry.sectionNumber}, column{" "}
                        {entry.columnNumber}
                      </span>
                    </span>
                  </button>
                  <div className="my-2 flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      aria-label={`Move block ${entry.blockNumber} up`}
                      title={`Move ${blockLabel(entry.block.type)} up`}
                      disabled={isFirstInColumn}
                      className={moveButtonClass}
                      onClick={() => onMoveBlock(entry, "up")}
                    >
                      <BuilderGlyph name="up" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move block ${entry.blockNumber} down`}
                      title={`Move ${blockLabel(entry.block.type)} down`}
                      disabled={isLastInColumn}
                      className={moveButtonClass}
                      onClick={() => onMoveBlock(entry, "down")}
                    >
                      <BuilderGlyph name="down" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Edit ${blockLabel(entry.block.type)} settings`}
                    title={`Edit ${blockLabel(entry.block.type)} settings`}
                    aria-pressed={isSelected}
                    className={`rounded-ui focus-visible:ring-ui-accent/30 my-2 flex size-9 shrink-0 items-center justify-center transition focus-visible:ring-2 focus-visible:outline-none ${
                      isSelected
                        ? "bg-ui-accent text-white"
                        : "bg-ui-canvas text-ui-text-muted hover:bg-ui-line"
                    }`}
                    onClick={() => onEditBlock(entry)}
                  >
                    <SettingsGlyph />
                  </button>
                  <div className="my-2 shrink-0">
                    <BlockPicker
                      triggerVariant="compact"
                      triggerLabel={`Add block below ${blockLabel(
                        entry.block.type,
                      )}`}
                      triggerAriaLabel={`Add block below block ${entry.blockNumber}`}
                      triggerButtonClassName={`rounded-ui focus-visible:ring-ui-accent/30 text-ui-text-muted inline-flex size-9 shrink-0 items-center justify-center transition focus-visible:ring-2 focus-visible:outline-none ${
                        isSelected
                          ? "bg-ui-surface hover:bg-ui-canvas"
                          : "bg-ui-canvas hover:bg-ui-line"
                      }`}
                      onAddBlock={(type, variant) =>
                        onCreateBlockAfter(entry, type, variant)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={onCreateBlock}
            className="rounded-ui-lg border-ui-line-strong bg-ui-canvas hover:border-ui-accent/50 hover:bg-ui-accent-soft focus-visible:ring-ui-accent/30 flex w-full flex-col items-center gap-2 border border-dashed px-4 py-6 text-center transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <span
              className="bg-ui-accent-soft text-ui-accent ring-ui-line flex size-9 items-center justify-center rounded-full ring-1"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="text-ui-text text-sm font-semibold">
              Add your first block
            </span>
            <span className="text-ui-text-subtle text-xs leading-5">
              Choose a content block to get started.
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

export function PageChromeControls({
  settings,
  onChange,
  qualificationSettings,
  onQualificationChange,
}: {
  settings: PageChromeSettings;
  onChange: (settings: Partial<PageChromeSettings>) => void;
  qualificationSettings: QualificationAttachmentSettings;
  onQualificationChange: (
    settings: Partial<QualificationAttachmentSettings>,
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <ChromeToggle
          label="Show header"
          checked={settings.showHeader}
          onChange={(checked) => onChange({ showHeader: checked })}
        />
        <ChromeToggle
          label="Show footer"
          checked={settings.showFooter}
          onChange={(checked) => onChange({ showFooter: checked })}
        />
      </div>
      <details className="border-ui-line bg-ui-canvas rounded-ui-lg border px-3 py-2">
        <summary className="text-ui-text-muted cursor-pointer text-sm font-semibold">
          Qualification follow-up
        </summary>
        <div className="mt-3 space-y-3">
          <TextInput
            label="Default form"
            placeholder="Published form ID"
            value={qualificationSettings.formId}
            onChange={(formId) => onQualificationChange({ formId })}
          />
          <TextInput
            label="Completion redirect"
            placeholder="/thank-you"
            value={qualificationSettings.completionRedirectPath}
            onChange={(completionRedirectPath) =>
              onQualificationChange({ completionRedirectPath })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Experiment key"
              placeholder="Optional"
              value={qualificationSettings.experimentKey}
              onChange={(experimentKey) =>
                onQualificationChange({ experimentKey })
              }
            />
            <TextInput
              label="Variant key"
              placeholder="Optional"
              value={qualificationSettings.variantKey}
              onChange={(variantKey) => onQualificationChange({ variantKey })}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function ChromeToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="text-ui-text-muted hover:text-ui-text rounded-ui flex cursor-pointer items-center gap-2.5 py-1 text-sm font-semibold transition">
      <span>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`peer-focus-visible:ring-ui-accent/40 flex h-5 w-9 items-center rounded-full p-0.5 ring-1 transition peer-focus-visible:ring-2 ${
          checked
            ? "bg-ui-accent ring-ui-accent"
            : "bg-ui-line ring-ui-line-strong"
        }`}
        aria-hidden="true"
      >
        <span
          className={`shadow-ui bg-ui-surface size-4 rounded-full transition ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}
