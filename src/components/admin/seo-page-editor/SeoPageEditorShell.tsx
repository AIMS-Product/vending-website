"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Wordmark } from "@/components/site/Wordmark";
import type { PageBlock, PageChromeSettings } from "@/lib/page-builder/blocks";
import type { BlockVariant } from "@/lib/page-builder/block-options";
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
import {
  BuilderGlyph,
  SettingsGlyph,
} from "@/components/admin/seo-page-editor/BuilderEditorUi";
import { BlockPicker } from "@/components/admin/seo-page-editor/BlockPicker";
import { footerColumns, primaryNav } from "@/lib/content/nav";

type CreationStep = 1 | 2 | 3;
type StartingPoint = "blank" | "template";

const creationSteps = [
  { step: 1 as const, label: "Page type" },
  { step: 2 as const, label: "Starting point" },
  { step: 3 as const, label: "Ready to build" },
];

export function NewPageChoiceGate({
  pageTypeOptions,
  savedTemplates = [],
  onChoosePageTemplate,
}: {
  pageTypeOptions: readonly PageTypeOption[];
  savedTemplates?: readonly SavedPageTemplateOption[];
  onChoosePageTemplate: (pageType: string, templateKey: string) => void;
}) {
  const [step, setStep] = useState<CreationStep>(1);
  const [selectedPageType, setSelectedPageType] =
    useState<PageTypeId>("resource");
  const [startingPoint, setStartingPoint] = useState<StartingPoint>("blank");
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
  const selectedPageTypeOption =
    pageTypeOptions.find((option) => option.id === selectedPageType) ??
    pageTypeOptions[0];
  const selectedSavedTemplate =
    templatesForPageType.find(
      (template) => template.id === selectedSavedTemplateId,
    ) ?? null;
  const startingPointLabel =
    startingPoint === "blank"
      ? "Blank page"
      : (selectedSavedTemplate?.label ?? "Template");

  const canContinueFromStep2 =
    startingPoint === "blank" ||
    (startingPoint === "template" &&
      hasSavedTemplates &&
      selectedSavedTemplate !== null);

  function goToStep2() {
    setStartingPoint("blank");
    setSelectedSavedTemplateId(null);
    setStep(2);
  }

  function handleStartBuilding() {
    const templateKey =
      startingPoint === "blank"
        ? "blank"
        : (selectedSavedTemplate?.templateKey ?? "blank");
    onChoosePageTemplate(selectedPageType, templateKey);
  }

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center border border-slate-200 bg-slate-100 px-4 py-8">
      <section
        className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl ring-1 ring-black/5 sm:p-8"
        aria-labelledby="new-page-choice-title"
      >
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-wider text-[#0b63f6] uppercase">
            SEO Page Builder
          </p>
          <h2
            id="new-page-choice-title"
            className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
          >
            Create page
          </h2>
        </div>

        <CreationStepIndicator currentStep={step} />

        <div className="mt-8 min-h-[280px]">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Step 1 of 3
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
                  What kind of page are you creating?
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Choose the page type that best matches your goal. You can
                  adjust details later in the builder.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pageTypeOptions.map((option) => {
                  const isSelected = option.id === selectedPageType;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`rounded-xl border p-4 text-left transition focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none ${
                        isSelected
                          ? "border-[#0b63f6] bg-[#f4f8ff] shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedPageType(option.id)}
                    >
                      <span className="block text-sm font-semibold text-slate-950">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Step 2 of 3
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
                  How would you like to start?
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Start from scratch or reuse a saved template for this page
                  type.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ChoiceCard
                  label="Blank page"
                  description="Start with an empty editable canvas."
                  selected={startingPoint === "blank"}
                  onClick={() => {
                    setStartingPoint("blank");
                    setSelectedSavedTemplateId(null);
                  }}
                />
                <ChoiceCard
                  label="Template"
                  description={
                    hasSavedTemplates
                      ? "Start from a saved page template."
                      : "No templates created"
                  }
                  selected={startingPoint === "template"}
                  disabled={!hasSavedTemplates}
                  onClick={() => {
                    if (!hasSavedTemplates) return;
                    setStartingPoint("template");
                    setSelectedSavedTemplateId(
                      templatesForPageType[0]?.id ?? null,
                    );
                  }}
                />
              </div>
              {startingPoint === "template" && hasSavedTemplates ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-950">
                    Choose a template
                  </p>
                  <div className="grid gap-2">
                    {templatesForPageType.map((template) => {
                      const isSelected =
                        template.id === selectedSavedTemplateId;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          className={`rounded-xl border p-4 text-left transition focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none ${
                            isSelected
                              ? "border-[#0b63f6] bg-[#f4f8ff] shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelectedSavedTemplateId(template.id)
                          }
                        >
                          <span className="block text-sm font-semibold text-slate-950">
                            {template.label}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-600">
                            {template.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Step 3 of 3
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
                  Ready to build your page
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Review your choices, then open the builder when you are ready.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Page type
                    </dt>
                    <dd className="mt-1 text-base font-semibold text-slate-950">
                      {selectedPageTypeOption?.label}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Starting point
                    </dt>
                    <dd className="mt-1 text-base font-semibold text-slate-950">
                      {startingPointLabel}
                    </dd>
                    {startingPoint === "template" &&
                    selectedSavedTemplate?.description ? (
                      <dd className="mt-1 text-sm leading-6 text-slate-600">
                        {selectedSavedTemplate.description}
                      </dd>
                    ) : null}
                  </div>
                </dl>
              </div>
            </div>
          ) : null}
        </div>

        <CreationStepActions
          step={step}
          canContinueFromStep2={canContinueFromStep2}
          onBack={() => setStep((current) => (current - 1) as CreationStep)}
          onContinueFromStep1={goToStep2}
          onContinueFromStep2={() => setStep(3)}
          onStartBuilding={handleStartBuilding}
        />
      </section>
    </div>
  );
}

function CreationStepIndicator({ currentStep }: { currentStep: CreationStep }) {
  return (
    <ol
      aria-label="Create page progress"
      className="grid grid-cols-3 gap-2 sm:gap-3"
    >
      {creationSteps.map(({ step, label }) => {
        const isComplete = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <li key={step} className="min-w-0">
            <div
              className={`h-1.5 rounded-full transition ${
                isComplete || isCurrent ? "bg-[#0b63f6]" : "bg-slate-200"
              }`}
              aria-hidden="true"
            />
            <p
              className={`mt-2 truncate text-xs font-medium ${
                isCurrent ? "text-[#0b63f6]" : "text-slate-500"
              }`}
            >
              {label}
            </p>
          </li>
        );
      })}
    </ol>
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
      className={`rounded-xl border p-4 text-left transition focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
          : selected
            ? "border-[#0b63f6] bg-[#f4f8ff] shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300"
      }`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="block text-sm font-semibold text-slate-950">
        {label}
      </span>
      <span className="mt-1 block text-sm leading-5 text-slate-600">
        {description}
      </span>
    </button>
  );
}

function CreationStepActions({
  step,
  canContinueFromStep2,
  onBack,
  onContinueFromStep1,
  onContinueFromStep2,
  onStartBuilding,
}: {
  step: CreationStep;
  canContinueFromStep2: boolean;
  onBack: () => void;
  onContinueFromStep1: () => void;
  onContinueFromStep2: () => void;
  onStartBuilding: () => void;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
      {step > 1 ? (
        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
          onClick={onBack}
        >
          Back
        </button>
      ) : (
        <span aria-hidden="true" />
      )}

      {step === 1 ? (
        <button
          type="button"
          className="min-h-11 rounded-lg border border-[#0b63f6] bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
          onClick={onContinueFromStep1}
        >
          Continue
        </button>
      ) : null}

      {step === 2 ? (
        <button
          type="button"
          disabled={!canContinueFromStep2}
          className="min-h-11 rounded-lg border border-[#0b63f6] bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
          onClick={onContinueFromStep2}
        >
          Continue
        </button>
      ) : null}

      {step === 3 ? (
        <button
          type="button"
          className="min-h-11 rounded-lg border border-[#0b63f6] bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
          onClick={onStartBuilding}
        >
          Start building page
        </button>
      ) : null}
    </div>
  );
}

export function EditorPublicHeader() {
  return (
    <header className="sticky inset-x-0 top-0 z-20 border-b-2 border-[#111111] bg-[#f5fbff]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-8 px-5 py-4 lg:px-10">
        <Link
          href="/"
          aria-label="Vendingpreneurs home"
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
          href="/apply"
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
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-xl">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-sky-300 uppercase">
              Page blocks
            </p>
            <h3 className="mt-1 text-base font-semibold">Builder outline</h3>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/10 ring-inset">
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

              return (
                <div
                  key={entry.block.id}
                  className={`flex items-stretch gap-2 rounded-xl border p-1.5 transition ${
                    isSelected
                      ? "border-sky-300 bg-white text-slate-950 shadow-sm"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
                    onClick={() => onSelectBlock(entry)}
                  >
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-sky-50 text-[#0b63f6] ring-1 ring-sky-100"
                          : "bg-white/10 text-slate-200 ring-1 ring-white/10"
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
                          <span className="size-2 rounded-full bg-amber-400" />
                        )}
                      </span>
                      <span
                        className={`mt-1 line-clamp-2 block text-xs leading-5 ${
                          isSelected ? "text-slate-500" : "text-slate-300"
                        }`}
                      >
                        {entry.blockNumber}. {blockSummary(entry.block)}
                      </span>
                      <span
                        className={`mt-1 block text-[11px] font-medium ${
                          isSelected ? "text-slate-400" : "text-slate-400"
                        }`}
                      >
                        Section {entry.sectionNumber}, column{" "}
                        {entry.columnNumber}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${blockLabel(entry.block.type)} settings`}
                    title={`Edit ${blockLabel(entry.block.type)} settings`}
                    aria-pressed={isSelected}
                    className={`my-2 flex size-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none ${
                      isSelected
                        ? "bg-[#0b63f6] text-white"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
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
                      triggerButtonClassName={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none ${
                        isSelected
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-white/10 text-slate-200 hover:bg-white/20"
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
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center transition hover:border-sky-300/60 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
          >
            <span
              className="flex size-9 items-center justify-center rounded-full bg-sky-400/20 text-sky-200 ring-1 ring-white/10"
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
            <span className="text-sm font-semibold text-white">
              Add your first block
            </span>
            <span className="text-xs leading-5 text-slate-300">
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
}: {
  settings: PageChromeSettings;
  onChange: (settings: Partial<PageChromeSettings>) => void;
}) {
  return (
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
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
      <span>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`flex h-5 w-9 items-center rounded-full p-0.5 ring-1 transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#0b63f6]/40 ${
          checked
            ? "bg-[#0b63f6] ring-[#0b63f6]"
            : "bg-slate-200 ring-slate-300"
        }`}
        aria-hidden="true"
      >
        <span
          className={`size-4 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}
