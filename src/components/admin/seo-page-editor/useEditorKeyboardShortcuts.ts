"use client";

import { useEffect } from "react";

import {
  isTextEntryElement,
  resolveEditorShortcut,
} from "@/components/admin/seo-page-editor/editor-keyboard-shortcuts";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

// I16 / N14: editor keyboard shortcuts. This hook only translates key presses
// into clicks/submits on EXISTING affordances; it never reimplements save or
// publish logic, so all gating (publish-blocker checklist, confirm step,
// validation) is preserved automatically.
//
// - Cmd/Ctrl+S → submit the real "Save draft" button (same path as the top
//   rail and the unsaved-exit guard), and preventDefault so the browser's
//   native Save dialog never appears.
// - Cmd/Ctrl+Enter → click the real Publish button, which is fully gated: a
//   blocked page reveals its blockers, a ready page opens the confirm step.
//   If the SEO panel is collapsed (so the button isn't mounted), open it first
//   then click on the next frame.
// - "/" with canvas/page focus (not in a text field) → click the block
//   picker's own trigger button to open it.

const SAVE_BUTTON_SELECTOR =
  'button[type="submit"][name="intent"][value="save"]';
const BLOCK_PICKER_TRIGGER_SELECTOR = '[data-testid="block-picker-trigger"]';
// Stable hook on the real Publish button in SeoPublishPanel — copy-proof,
// unlike matching the button's visible label text.
const PUBLISH_BUTTON_SELECTOR = '[data-testid="seo-publish-button"]';

function clickRealPublishButton(form: HTMLFormElement): boolean {
  const publishButton = form.querySelector<HTMLButtonElement>(
    PUBLISH_BUTTON_SELECTOR,
  );
  if (!publishButton) return false;
  publishButton.click();
  return true;
}

/**
 * Resolve the editor form via its existing Save submit button rather than a
 * ref, since the controller does not expose `formRef`. The save button is a
 * stable, single-purpose affordance, and `button.form` walks back to the
 * owning `<form>`.
 */
function getEditorForm(): HTMLFormElement | null {
  const saveButton =
    document.querySelector<HTMLButtonElement>(SAVE_BUTTON_SELECTOR);
  return saveButton?.form ?? null;
}

export function useEditorKeyboardShortcuts(editor: SeoPageEditorController) {
  const { isSeoSidebarCollapsed, toggleSeoSidebar } = editor;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = resolveEditorShortcut({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        isTextEntryTarget: isTextEntryElement(event.target),
      });
      if (!action) return;

      const form = getEditorForm();
      if (!form) return;

      if (action === "save") {
        const saveButton =
          form.querySelector<HTMLButtonElement>(SAVE_BUTTON_SELECTOR);
        if (!saveButton) return;
        event.preventDefault();
        form.requestSubmit(saveButton);
        return;
      }

      if (action === "publish") {
        event.preventDefault();
        if (clickRealPublishButton(form)) return;
        // Panel collapsed → reveal it, then click the now-mounted button.
        if (isSeoSidebarCollapsed) {
          toggleSeoSidebar();
          requestAnimationFrame(() => {
            const current = getEditorForm();
            if (current) clickRealPublishButton(current);
          });
        }
        return;
      }

      // open-block-picker
      const trigger = form.querySelector<HTMLButtonElement>(
        BLOCK_PICKER_TRIGGER_SELECTOR,
      );
      if (!trigger) return;
      event.preventDefault();
      trigger.click();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSeoSidebarCollapsed, toggleSeoSidebar]);
}
