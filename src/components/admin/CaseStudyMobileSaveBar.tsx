// Mirrors NewsMobileSaveBar: below `lg`, the Publish aside stacks under the
// long-form fields, so "Save draft" is never on screen while editing. This
// viewport-fixed bar keeps Save reachable on narrow screens and routes
// Publish through CaseStudyPublishButton so it shows the same accessible
// confirm as the desktop aside.

import { CaseStudyPublishButton } from "@/components/admin/CaseStudyPublishButton";

export function CaseStudyMobileSaveBar({
  formId,
  publishDisabled,
  publishDisabledReason,
}: {
  formId: string;
  publishDisabled: boolean;
  publishDisabledReason?: string;
}) {
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
        <CaseStudyPublishButton
          formId={formId}
          disabled={publishDisabled}
          disabledReason={publishDisabledReason}
          className="border-ui-accent/20 bg-ui-accent hover:bg-ui-accent-hover focus-visible:ring-ui-accent/20 inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-5 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-4 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
