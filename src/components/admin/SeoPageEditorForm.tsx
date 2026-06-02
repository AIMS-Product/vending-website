"use client";

import { useRef } from "react";
import { MediaPickerProvider } from "@/components/admin/MediaPickerProvider";
import { NewPageChoiceGate } from "@/components/admin/seo-page-editor/SeoPageEditorShell";
import { SeoPageEditorWorkspace } from "@/components/admin/seo-page-editor/SeoPageEditorWorkspace";
import {
  useSeoPageEditorController,
  type SeoPageEditorControllerProps,
  type SeoPageEditorMediaAsset,
} from "@/components/admin/seo-page-editor/useSeoPageEditorController";

export type { SeoPageEditorMediaAsset };

type SeoPageEditorFormProps = SeoPageEditorControllerProps;

export function SeoPageEditorForm(props: SeoPageEditorFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const editor = useSeoPageEditorController(props, formRef);

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
    </MediaPickerProvider>
  );
}
