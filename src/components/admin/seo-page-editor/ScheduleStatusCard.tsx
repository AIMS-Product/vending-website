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
      <section className="rounded-ui-lg border-ui-bad/25 bg-ui-bad-fill border p-4">
        <div className="flex items-center gap-2">
          <span
            className="bg-ui-bad size-2 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <h3 className="text-ui-bad-ink text-sm font-semibold">
            Scheduled publish failed
          </h3>
        </div>
        {status.display ? (
          <p className="text-ui-bad-ink mt-1.5 text-xs font-medium">
            Was scheduled for {status.display}.
          </p>
        ) : null}
        <p className="text-ui-bad-ink mt-1.5 text-sm leading-5">
          {status.error}
        </p>
        <p className="text-ui-bad-ink mt-2 text-xs leading-5">
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
    <section className="rounded-ui-lg border-ui-accent/25 bg-ui-accent-soft border p-4">
      <div className="flex items-center gap-2">
        <span
          className="bg-ui-accent size-2 shrink-0 rounded-full"
          aria-hidden="true"
        />
        <h3 className="text-ui-accent text-sm font-semibold">
          Scheduled to publish
        </h3>
      </div>
      <p className="text-ui-accent mt-1.5 text-sm leading-5 font-semibold">
        {status.display}
      </p>
      <p className="text-ui-accent mt-1.5 text-xs leading-5">
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
      ? "border-ui-bad/25 text-ui-bad-ink hover:bg-ui-bad-fill focus-visible:ring-ui-bad/25"
      : "border-ui-accent/25 text-ui-accent hover:bg-ui-accent-soft focus-visible:ring-ui-accent/25";
  return (
    <button
      type="button"
      onClick={onCancelSchedule}
      disabled={isCancelling}
      className={`rounded-ui-lg bg-ui-surface shadow-ui inline-flex min-h-9 items-center justify-center border px-3 text-xs font-semibold transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {isCancelling ? "Cancelling…" : "Cancel scheduled publish"}
    </button>
  );
}
