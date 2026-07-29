"use client";

import { useEffect, useId, useRef, useState } from "react";

export type AdminTermHintProps = {
  /** The jargon term shown inline, e.g. "301". */
  term: string;
  /** Short plain-English explanation revealed on activation. */
  explanation: string;
};

// Generic, reusable inline hint for jargon terms across admin surfaces (I9).
// A `title` attribute is not enough here: it never reaches touch users and is
// unreliable for keyboard/screen-reader users. Instead this is a real
// keyboard-focusable <button> that toggles a visible, `aria-describedby`-linked
// disclosure panel — so it works identically on click, tap, and Enter/Space.
export function AdminTermHint({ term, explanation }: AdminTermHintProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={open ? panelId : undefined}
        className="focus-visible:ring-ui-accent/35 inline-flex items-center gap-1 rounded-sm border-b border-dotted border-slate-400 pb-px text-inherit decoration-0 underline-offset-2 outline-none focus-visible:rounded focus-visible:ring-2"
      >
        {term}
        <span
          aria-hidden="true"
          className="bg-ui-line text-ui-text-subtle flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
        >
          ?
        </span>
      </button>
      {open ? (
        <span
          id={panelId}
          role="note"
          className="border-ui-line text-ui-text-muted absolute top-[calc(100%+0.4rem)] left-0 z-20 w-[min(16rem,calc(100vw-2rem))] rounded-lg border bg-white px-3 py-2 text-xs leading-5 font-normal normal-case shadow-lg"
        >
          {explanation}
        </span>
      ) : null}
    </span>
  );
}
