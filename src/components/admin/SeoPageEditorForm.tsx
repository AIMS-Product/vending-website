"use client";

import { useCallback, useRef } from "react";
import { MediaPickerProvider } from "@/components/admin/MediaPickerProvider";
import { NewPageChoiceGate } from "@/components/admin/seo-page-editor/SeoPageEditorShell";
import { SeoPageEditorWorkspace } from "@/components/admin/seo-page-editor/SeoPageEditorWorkspace";
import { DraftCreatedNotice } from "@/components/admin/seo-page-editor/DraftCreatedNotice";
import { UnsavedExitDialog } from "@/components/admin/seo-page-editor/UnsavedExitDialog";
import { isAutoCreatedNeverSavedDraft } from "@/components/admin/seo-page-editor/unsaved-exit-guard-state";
import { useUnsavedExitGuard } from "@/components/admin/seo-page-editor/useUnsavedExitGuard";
import {
  useSeoPageEditorController,
  type SeoPageEditorControllerProps,
} from "@/components/admin/seo-page-editor/useSeoPageEditorController";

type SeoPageEditorFormProps = SeoPageEditorControllerProps;

export function SeoPageEditorForm(props: SeoPageEditorFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const editor = useSeoPageEditorController(props, formRef);

  // N6 / issue I5: trigger the editor's own Save draft submit button so saving
  // from the unsaved-exit guard reuses the exact same path as the top-rail
  // button (validation, redirect, remount), with no duplicated save logic.
  const saveDraft = useCallback(() => {
    const form = formRef.current;
    const saveButton = form?.querySelector<HTMLButtonElement>(
      'button[type="submit"][name="intent"][value="save"]',
    );
    if (form && saveButton) {
      form.requestSubmit(saveButton);
    }
  }, []);

  // The user has explicitly saved/published this session when the editor's
  // own save action reports "saved", or when the page loaded after a `?saved=1`
  // redirect. This disarms the guard even when an in-place save (already
  // auto-created row) does not remount with a real `page` prop.
  const explicitlySavedThisSession =
    editor.state.status === "saved" || editor.savedFromRedirect;

  const guardInput = {
    loadedPageId: editor.page?.id,
    effectivePageId: editor.effectivePageId,
    explicitlySavedThisSession,
  };

  const exitGuard = useUnsavedExitGuard({
    ...guardInput,
    onSaveDraft: saveDraft,
  });

  const showDraftCreatedNotice = isAutoCreatedNeverSavedDraft(guardInput);

  if (editor.showCreationChoiceModal) {
    return (
      <NewPageChoiceGate
        pageTypeOptions={editor.pageTypeOptions}
        onChoosePageTemplate={editor.onChoosePageTemplate}
      />
    );
  }

  return (
    <MediaPickerProvider initialAssets={editor.mediaAssets}>
      <form
        action={editor.formAction}
        className="relative"
        onSubmit={editor.handleEditorFormSubmit}
        ref={formRef}
      >
        <SeoPageEditorWorkspace editor={editor} />
      </form>
      {showDraftCreatedNotice ? <DraftCreatedNotice /> : null}
      {exitGuard.isOpen ? (
        <UnsavedExitDialog
          isDiscarding={exitGuard.isDiscarding}
          errorMessage={exitGuard.errorMessage}
          onChoose={exitGuard.resolve}
        />
      ) : null}
    </MediaPickerProvider>
  );
}
