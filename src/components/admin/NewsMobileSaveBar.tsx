// S19 (finding C145): below `lg`, NewsEditorForm's Publish aside stacks ~1500px
// under the body field, so "Save draft" is never on screen while editing. This
// viewport-fixed bar keeps Save reachable on narrow screens. It submits the
// editor form via the `form` attribute and the same `intent=save` button the
// Publish aside uses, so the save path is reused, never forked. Hidden at `lg`
// and up so the desktop two-column layout is untouched.
//
// I12: the mobile Publish button routes through NewsPublishButton so it shows
// the same accessible "Publish this post?" confirm as the desktop aside — the
// live action is never a single unguarded tap.

import { NewsPublishButton } from "@/components/admin/NewsPublishButton";

export function NewsMobileSaveBar({ formId }: { formId: string }) {
  return (
    <div
      className="border-ui-line fixed inset-x-0 bottom-0 z-[60] border-t bg-white/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden"
      role="region"
      aria-label="Editor actions"
    >
      <div className="mx-auto flex max-w-[1500px] items-center justify-center gap-2">
        <button
          type="submit"
          form={formId}
          name="intent"
          value="save"
          className="border-ui-line text-ui-text-muted hover:border-ui-line-strong hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/20 inline-flex min-h-11 flex-1 items-center justify-center rounded-full border bg-white px-5 text-sm font-semibold shadow-sm transition focus-visible:ring-4 focus-visible:outline-none"
        >
          Save draft
        </button>
        <NewsPublishButton
          formId={formId}
          className="border-ui-accent/20 bg-ui-accent hover:bg-ui-accent-hover focus-visible:ring-ui-accent/20 inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-5 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-4 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
