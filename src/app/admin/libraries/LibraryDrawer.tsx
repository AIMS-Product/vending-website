"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// P1-7 / I10: each library now opens a focused drawer instead of an
// always-open form. This mirrors NewsPublishButton's accessible <dialog>
// pattern: real <dialog> opened with showModal(), focus moved to a safe
// control on open, focus restored to the trigger on close, Escape/backdrop
// dismiss via the dialog's native onCancel/light-dismiss behavior.

type LibraryDrawerProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

export function LibraryDrawer({
  title,
  description,
  onClose,
  children,
}: LibraryDrawerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      if (dialog?.open) dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-950/35"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex min-h-full items-start justify-end sm:items-stretch">
        <div className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2
                id={titleId}
                className="text-base font-semibold text-slate-950"
              >
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
              aria-label={`Close ${title} drawer`}
              onClick={onClose}
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
