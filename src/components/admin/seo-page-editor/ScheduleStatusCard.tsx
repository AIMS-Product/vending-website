"use client";

import type { ScheduleStatus } from "@/components/admin/seo-page-editor/schedule-status";

// Always-visible scheduled / failed surface for the publish panel. Renders
// nothing when there is no active schedule, so it never adds a duplicate empty
// panel. The Cancel button reuses the editor's existing save-based cancel path.
export function ScheduleStatusCard({
  status,
  isCancelling,
  onCancelSchedule,
}: {
  status: ScheduleStatus;
  isCancelling: boolean;
  onCancelSchedule: () => void;
}) {
  if (status.kind === "none") return null;

  if (status.kind === "failed") {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full bg-rose-500"
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold text-rose-900">
            Scheduled publish failed
          </h3>
        </div>
        {status.display ? (
          <p className="mt-1.5 text-xs font-medium text-rose-800">
            Was scheduled for {status.display}.
          </p>
        ) : null}
        <p className="mt-1.5 text-sm leading-5 text-rose-800">{status.error}</p>
        <p className="mt-2 text-xs leading-5 text-rose-700">
          Save a new scheduled time below to retry, or cancel the schedule.
        </p>
        <div className="mt-3">
          <CancelScheduleButton
            isCancelling={isCancelling}
            onCancelSchedule={onCancelSchedule}
            tone="rose"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full bg-sky-500"
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-sky-900">
          Scheduled to publish
        </h3>
      </div>
      <p className="mt-1.5 text-sm leading-5 font-semibold text-sky-900">
        {status.display}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-sky-700">
        This draft publishes automatically at that time. The live page is not
        updated until then.
      </p>
      <div className="mt-3">
        <CancelScheduleButton
          isCancelling={isCancelling}
          onCancelSchedule={onCancelSchedule}
          tone="sky"
        />
      </div>
    </section>
  );
}

function CancelScheduleButton({
  isCancelling,
  onCancelSchedule,
  tone,
}: {
  isCancelling: boolean;
  onCancelSchedule: () => void;
  tone: "sky" | "rose";
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-300 text-rose-800 hover:bg-rose-100 focus-visible:ring-rose-200"
      : "border-sky-300 text-sky-800 hover:bg-sky-100 focus-visible:ring-sky-200";
  return (
    <button
      type="button"
      onClick={onCancelSchedule}
      disabled={isCancelling}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg border bg-white px-3 text-xs font-semibold shadow-sm transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {isCancelling ? "Cancelling…" : "Cancel scheduled publish"}
    </button>
  );
}
