// S19 (finding C145): below `lg`, NewsEditorForm's Publish aside stacks ~1500px
// under the body field, so "Save draft" is never on screen while editing. This
// viewport-fixed bar keeps Save reachable on narrow screens. It submits the
// editor form via the `form` attribute and the same `intent=save` button the
// Publish aside uses, so the save path is reused, never forked. Hidden at `lg`
// and up so the desktop two-column layout is untouched.

export function NewsMobileSaveBar({ formId }: { formId: string }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden"
      role="region"
      aria-label="Editor actions"
    >
      <div className="mx-auto flex max-w-[1500px] items-center justify-center gap-2">
        <button
          type="submit"
          form={formId}
          name="intent"
          value="save"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
        >
          Save draft
        </button>
        <button
          type="submit"
          form={formId}
          name="intent"
          value="publish"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[#0b63f6]/20 bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
        >
          Publish
        </button>
      </div>
    </div>
  );
}
