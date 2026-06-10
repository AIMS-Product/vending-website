"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PageBlock } from "@/lib/page-builder/blocks";
import type { MoveDirection } from "@/lib/page-builder/editor-state";
import {
  dangerButtonClass,
  iconButtonClass,
  menuButtonClass,
} from "@/components/admin/seo-page-editor/editor-styles";

const builderGlyphCommonProps = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  className: "size-4",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type BlockToolbarStructure = {
  label: string;
  detail: string;
  currentIndex: number;
  itemCount: number;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  addColumnLabel: string;
  addColumnDisabled: boolean;
  onAddColumn: () => void;
  removeLabel: string;
  onRemove: () => void;
};

export function SettingsGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function MovePositionMenu({
  label,
  currentIndex,
  itemCount,
  onMove,
  onMoveToIndex,
  upLabel = "Move up one",
  downLabel = "Move down one",
  positionHeading = "Move to position",
  positionLabel = (index: number) => `Position ${index + 1}`,
  align = "center",
}: {
  label: string;
  currentIndex: number;
  itemCount: number;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  upLabel?: string;
  downLabel?: string;
  positionHeading?: string;
  positionLabel?: (index: number) => string;
  align?: "center" | "start" | "end";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === itemCount - 1;
  const menuAlignClass =
    align === "end"
      ? "right-0"
      : align === "start"
        ? "left-0"
        : "left-1/2 -translate-x-1/2";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <BuilderTooltip
        label="Move"
        detail={`Change where ${label} appears · ${upLabel.toLowerCase()}, ${downLabel.toLowerCase()}, or pick a position`}
        align={align}
      >
        <button
          type="button"
          aria-label={`Move ${label}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={iconButtonClass}
          onClick={() => setIsOpen((open) => !open)}
        >
          <BuilderGlyph name="grip" />
        </button>
      </BuilderTooltip>
      {isOpen && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 absolute z-40 mt-2 min-w-[188px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 ${menuAlignClass}`}
        >
          <button
            type="button"
            className={menuButtonClass}
            disabled={isFirst}
            onClick={() => {
              onMove("up");
              setIsOpen(false);
            }}
          >
            {upLabel}
          </button>
          <button
            type="button"
            className={menuButtonClass}
            disabled={isLast}
            onClick={() => {
              onMove("down");
              setIsOpen(false);
            }}
          >
            {downLabel}
          </button>
          {itemCount > 1 ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                {positionHeading}
              </p>
              {Array.from({ length: itemCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={menuButtonClass}
                  disabled={index === currentIndex}
                  aria-current={index === currentIndex ? "true" : undefined}
                  onClick={() => {
                    onMoveToIndex(index);
                    setIsOpen(false);
                  }}
                >
                  {positionLabel(index)}
                  {index === currentIndex ? " (current)" : ""}
                </button>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function BuilderTooltip({
  label,
  detail,
  children,
  className,
  align = "center",
}: {
  label: string;
  detail?: string;
  children: ReactNode;
  className?: string;
  align?: "center" | "start" | "end";
}) {
  const alignClass =
    align === "start"
      ? "left-0 translate-x-0"
      : align === "end"
        ? "right-0 translate-x-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span
      className={`group/builder-tooltip relative inline-flex ${className ?? ""}`}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-[calc(100%+0.45rem)] z-30 hidden w-max max-w-64 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-left text-[11px] leading-4 text-white shadow-lg group-focus-within/builder-tooltip:block group-hover/builder-tooltip:block ${alignClass}`}
      >
        <span className="block font-semibold">{label}</span>
        {detail ? (
          <span className="mt-1 block font-normal text-slate-300">
            {detail}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function BlockToolbar({
  label,
  typeLabel,
  variantLabel,
  description,
  status,
  statusDetail,
  icon,
  blockIndex,
  blockCount,
  onMove,
  onMoveToIndex,
  onDuplicate,
  onRemove,
  onEditSettings,
  structure,
}: {
  label: string;
  typeLabel: string;
  variantLabel: string;
  description: string;
  status: string;
  statusDetail?: string;
  icon: PageBlock["type"];
  blockIndex: number;
  blockCount: number;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEditSettings: () => void;
  structure?: BlockToolbarStructure;
}) {
  const readyDetail = `${label} · ${description}`;
  const variantDetail = `${typeLabel} layout · ${description}${
    status === "Ready" ? " · Ready" : ""
  }`;
  const moveControl =
    structure && structure.itemCount > 1
      ? {
          label: structure.label.toLowerCase(),
          currentIndex: structure.currentIndex,
          itemCount: structure.itemCount,
          onMove: structure.onMove,
          onMoveToIndex: structure.onMoveToIndex,
          upLabel: "Move section up",
          downLabel: "Move section down",
        }
      : blockCount > 1
        ? {
            label,
            currentIndex: blockIndex,
            itemCount: blockCount,
            onMove,
            onMoveToIndex,
            upLabel: "Move up one",
            downLabel: "Move down one",
          }
        : null;

  return (
    <header className="pointer-events-auto flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-xs opacity-100 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.45)] ring-1 ring-black/5 backdrop-blur transition-all md:opacity-0 md:group-focus-within/editor:opacity-100 md:group-hover/editor:opacity-100">
      <div className="flex min-w-0 items-center gap-2">
        <BuilderTooltip label={`${typeLabel} block`} detail={readyDetail}>
          <span
            role="img"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500 ring-1 ring-slate-200/50 ring-inset"
            aria-label={`${typeLabel} block`}
          >
            <BuilderGlyph name={icon} />
          </span>
        </BuilderTooltip>
        {structure ? (
          <BuilderTooltip label={structure.label} detail={structure.detail}>
            <span className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase ring-1 ring-slate-200/70 ring-inset">
              {structure.label}
            </span>
          </BuilderTooltip>
        ) : null}
        <span className="flex min-w-0 items-center gap-2">
          <BuilderTooltip label={variantLabel} detail={variantDetail}>
            <span className="truncate text-[11px] font-medium text-slate-600">
              {variantLabel}
            </span>
          </BuilderTooltip>
          {status !== "Ready" && (
            <BuilderTooltip label={status} detail={statusDetail ?? description}>
              <span
                role="img"
                className="size-2 shrink-0 rounded-full bg-amber-400"
                aria-label={status}
              />
            </BuilderTooltip>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {moveControl ? (
          <div className="rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
            <MovePositionMenu
              label={moveControl.label}
              currentIndex={moveControl.currentIndex}
              itemCount={moveControl.itemCount}
              onMove={moveControl.onMove}
              onMoveToIndex={moveControl.onMoveToIndex}
              upLabel={moveControl.upLabel}
              downLabel={moveControl.downLabel}
              align="end"
            />
          </div>
        ) : null}
        <div className="rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
          <MoreActions
            label={structure ? "Section and block actions" : "Block actions"}
            detail={
              structure
                ? "Edit content settings or manage this page section"
                : "Edit settings, duplicate, or remove this block"
            }
            align="end"
          >
            <button
              type="button"
              className={menuButtonClass}
              onClick={onEditSettings}
            >
              Edit settings
            </button>
            <button
              type="button"
              className={menuButtonClass}
              onClick={onDuplicate}
            >
              Duplicate content
            </button>
            {structure ? (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  className={`${menuButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={structure.addColumnDisabled}
                  onClick={structure.onAddColumn}
                >
                  {structure.addColumnLabel}
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={structure.onRemove}
                >
                  {structure.removeLabel}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={dangerButtonClass}
              onClick={onRemove}
            >
              Remove content
            </button>
          </MoreActions>
        </div>
      </div>
    </header>
  );
}

export function MoreActions({
  label,
  detail,
  align = "center",
  children,
}: {
  label: string;
  detail?: string;
  align?: "center" | "start" | "end";
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <BuilderTooltip label={label} detail={detail} align={align}>
        <button
          type="button"
          aria-label={label}
          className={iconButtonClass}
          onClick={() => setIsOpen(!isOpen)}
        >
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
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </BuilderTooltip>
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 absolute right-0 z-20 mt-2 min-w-[160px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5">
          {children}
        </div>
      )}
    </div>
  );
}

export function BuilderGlyph({
  name,
}: {
  name: PageBlock["type"] | "up" | "down" | "more" | "grip";
}) {
  if (name === "up") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="m6 15 6-6 6 6" />
      </svg>
    );
  }
  if (name === "down") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  if (name === "more") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M12 5h.01" />
        <path d="M12 12h.01" />
        <path d="M12 19h.01" />
      </svg>
    );
  }
  if (name === "grip") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M9 5h.01" />
        <path d="M15 5h.01" />
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
        <path d="M9 19h.01" />
        <path d="M15 19h.01" />
      </svg>
    );
  }
  if (name === "hero") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M4 6h16" />
        <path d="M4 10h10" />
        <path d="M4 15h8" />
        <path d="M4 19h5" />
      </svg>
    );
  }
  if (name === "rich_text") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M5 6h14" />
        <path d="M5 11h14" />
        <path d="M5 16h9" />
      </svg>
    );
  }
  if (name === "image") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M4 5h16v14H4V5Z" />
        <path d="m5 17 5-5 4 4 2-2 3 3" />
        <path d="M15 9h.01" />
      </svg>
    );
  }
  if (name === "cta") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M5 8h14v8H5V8Z" />
        <path d="M9 12h6" />
      </svg>
    );
  }
  if (name === "faq") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M12 18h.01" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.8.6-1.6 1.2-1.6 2.6" />
        <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
      </svg>
    );
  }
  if (name === "card_grid") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M4 5h7v6H4V5Z" />
        <path d="M13 5h7v6h-7V5Z" />
        <path d="M4 13h7v6H4v-6Z" />
        <path d="M13 13h7v6h-7v-6Z" />
      </svg>
    );
  }
  if (name === "proof") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="m12 3 3 6 6 .9-4.5 4.4 1.1 6.2L12 17l-5.6 3.5 1.1-6.2L3 9.9 9 9l3-6Z" />
      </svg>
    );
  }
  if (name === "video") {
    return (
      <svg {...builderGlyphCommonProps}>
        <path d="M4 6h12v12H4V6Z" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
    );
  }
  return (
    <svg {...builderGlyphCommonProps}>
      <path d="M6 4h12v16H6V4Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
    </svg>
  );
}
