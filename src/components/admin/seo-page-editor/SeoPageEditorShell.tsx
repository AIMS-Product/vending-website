"use client";

import Link from "next/link";
import { Wordmark } from "@/components/site/Wordmark";
import type { PageChromeSettings } from "@/lib/page-builder/blocks";
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
import { footerColumns, primaryNav } from "@/lib/content/nav";

export function NewPageChoiceGate({
  onCreateFromScratch,
}: {
  onCreateFromScratch: () => void;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center border border-slate-200 bg-slate-100 px-4 py-12">
      <section
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-7"
        aria-labelledby="new-page-choice-title"
      >
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-wider text-[#0b63f6] uppercase">
            SEO Page Builder
          </p>
          <h2
            id="new-page-choice-title"
            className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
          >
            Create page
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Start with a blank editable page. The SEO checklist, page canvas,
            and publish controls appear after this choice.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border-2 border-[#0b63f6] bg-[#f4f8ff] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
            onClick={onCreateFromScratch}
          >
            <span className="block text-lg font-semibold text-slate-950">
              From scratch
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-600">
              Start with a blank editable page.
            </span>
          </button>
          <button
            type="button"
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 p-5 text-left opacity-70"
            disabled
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-slate-950">
                From template
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Coming soon
              </span>
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              Use approved page patterns.
            </span>
          </button>
        </div>
      </section>
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
}: {
  entries: BuilderBlockEntry[];
  selectedEntry: BuilderBlockEntry | null;
  onSelectBlock: (entry: BuilderBlockEntry) => void;
  onEditBlock: (entry: BuilderBlockEntry) => void;
  onCreateBlock: () => void;
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
