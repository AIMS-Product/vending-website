import {
  applyPageBuilderAiToolCalls,
  type PageBuilderAiApplyResult,
  type PageBuilderAiToolCall,
} from "@/lib/page-builder/ai-chat";
import type { PageContent } from "@/lib/page-builder/blocks";

type EditorAiToolApplicationOptions = {
  content: PageContent;
  toolCalls: PageBuilderAiToolCall[];
  makeBlockId: () => string;
  replaceContent: (content: PageContent) => void;
  setTitle: (value: string) => void;
  setSlugTouched: (value: boolean) => void;
  setSlug: (value: string) => void;
  setTargetKeyword: (value: string) => void;
  setSeoTitle: (value: string) => void;
  setMetaDescription: (value: string) => void;
  setSelectedBlockId: (value: string) => void;
  scheduleBlockScroll: (blockId: string) => void;
};

export function applyPageBuilderAiToolsToEditor({
  content,
  toolCalls,
  makeBlockId,
  replaceContent,
  setTitle,
  setSlugTouched,
  setSlug,
  setTargetKeyword,
  setSeoTitle,
  setMetaDescription,
  setSelectedBlockId,
  scheduleBlockScroll,
}: EditorAiToolApplicationOptions): PageBuilderAiApplyResult {
  const result = applyPageBuilderAiToolCalls({
    content,
    toolCalls,
    makeBlockId,
  });

  if (result.content !== content) {
    replaceContent(result.content);
  }

  if (result.seoPatch.title !== undefined) setTitle(result.seoPatch.title);
  if (result.seoPatch.slug !== undefined) {
    setSlugTouched(true);
    setSlug(result.seoPatch.slug);
  }
  if (result.seoPatch.targetKeyword !== undefined) {
    setTargetKeyword(result.seoPatch.targetKeyword);
  }
  if (result.seoPatch.seoTitle !== undefined) {
    setSeoTitle(result.seoPatch.seoTitle);
  }
  if (result.seoPatch.metaDescription !== undefined) {
    setMetaDescription(result.seoPatch.metaDescription);
  }

  const lastHighlightedId = result.highlightedBlockIds.at(-1);
  if (lastHighlightedId) {
    setSelectedBlockId(lastHighlightedId);
    scheduleBlockScroll(lastHighlightedId);
  }

  return result;
}
