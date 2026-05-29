"use client";

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
  const editor = useSeoPageEditorController(props);

  if (editor.showCreationChoiceModal) {
    return (
      <NewPageChoiceGate onCreateFromScratch={editor.onCreateFromScratch} />
    );
  }

  return (
    <MediaPickerProvider initialAssets={editor.mediaAssets}>
      <form
        action={editor.formAction}
        className="relative"
        onSubmit={editor.handleEditorFormSubmit}
      >
        <SeoPageEditorWorkspace editor={editor} />
      </form>
    </MediaPickerProvider>
  );
}
