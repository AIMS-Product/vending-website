"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// I12: Publish sits directly beside "Save draft" and takes the post live with no
// warning. This button mirrors AdminPageActionButton's accessible confirm
// semantics (a modal <dialog> opened with showModal(), focus moved to Cancel,
// focus restored on close, Escape cancels) but carries `name="intent"
// value="publish"` so it drives the editor's existing publish path unchanged.
// The confirm only intercepts the FIRST click; on Confirm we re-submit the same
// button so the real form submission (and its intent) fires normally.

export function NewsPublishButton({
  className,
  label = "Publish",
  formId,
}: {
  className: string;
  label?: string;
  formId?: string;
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
        onClick={(event) => {
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
              <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <h2
                  id={confirmTitleId}
                  className="text-base font-semibold text-slate-950"
                >
                  Publish this post?
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This makes the post publicly visible at your blog right away.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                    onClick={() => setIsConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center rounded-md bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
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
