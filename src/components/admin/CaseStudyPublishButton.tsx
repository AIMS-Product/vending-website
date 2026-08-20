"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Mirrors NewsPublishButton: an accessible confirm (a modal <dialog> opened
// with showModal(), focus moved to Cancel, focus restored on close, Escape
// cancels) in front of `name="intent" value="publish"`. The confirm only
// intercepts the FIRST click; on Confirm we re-submit the same button so the
// real form submission (and its intent) fires normally.

export function CaseStudyPublishButton({
  className,
  label = "Publish",
  formId,
  disabled = false,
  disabledReason,
}: {
  className: string;
  label?: string;
  formId?: string;
  /** True when the row cannot legally publish yet (no video id). */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const confirmTitleId = useId();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const confirmedSubmitRef = useRef(false);

  useEffect(() => {
    if (!isConfirmOpen) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelButtonRef.current?.focus();

    return () => {
      if (dialog?.open) dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isConfirmOpen]);

  function submitConfirmedAction() {
    // Re-submit the real Publish button so the form's action fires with
    // intent=publish, exactly as an un-guarded click would have.
    confirmedSubmitRef.current = true;
    const form = buttonRef.current?.form;
    if (form && buttonRef.current) {
      form.requestSubmit(buttonRef.current);
    }
    confirmedSubmitRef.current = false;
    setIsConfirmOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        className={className}
        form={formId}
        name="intent"
        value="publish"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          if (!confirmedSubmitRef.current) {
            event.preventDefault();
            setIsConfirmOpen(true);
          }
        }}
      >
        {label}
      </button>
      {isConfirmOpen &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-labelledby={confirmTitleId}
            className="fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-950/35"
            onCancel={() => setIsConfirmOpen(false)}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <div className="border-ui-line w-full max-w-sm rounded-lg border bg-white p-5 shadow-xl">
                <h2
                  id={confirmTitleId}
                  className="text-ui-text text-base font-semibold"
                >
                  Publish this case study?
                </h2>
                <p className="text-ui-text-muted mt-3 text-sm leading-6">
                  This makes the case study publicly visible right away.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    className="border-ui-line text-ui-text-muted hover:bg-ui-canvas focus-visible:ring-ui-accent/35 inline-flex min-h-10 items-center rounded-md border bg-white px-4 text-sm font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => setIsConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bg-ui-accent hover:bg-ui-accent-hover focus-visible:ring-ui-accent/35 inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:outline-none"
                    onClick={submitConfirmedAction}
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
