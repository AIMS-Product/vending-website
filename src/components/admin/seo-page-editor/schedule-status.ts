import {
  SCHEDULED_PUBLISH_TIME_ZONE,
  SCHEDULED_PUBLISH_TIME_ZONE_LABEL,
  formatScheduledPublishDisplay,
} from "@/lib/page-builder/scheduled-publishing";

// What the schedule surface should show. Derived purely from the persisted
// scheduler columns — this module never writes them.
export type ScheduleStatus =
  | { kind: "none" }
  | { kind: "scheduled"; at: string; display: string }
  | {
      kind: "failed";
      at: string | null;
      display: string | null;
      error: string;
    };

type ScheduleSourcePage =
  | {
      scheduled_publish_status?: string | null;
      scheduled_publish_at?: string | null;
      scheduled_publish_error?: string | null;
    }
  | null
  | undefined;

// Pacific-Time display label used by both the scheduled and failed surfaces,
// e.g. "Jun 12, 2026, 9:00 AM PDT (Pacific Time)". Timezone handling is
// untouched: this only appends the human label to the existing formatter.
export function scheduleDisplayLabel(
  iso: string | null | undefined,
  timeZone = SCHEDULED_PUBLISH_TIME_ZONE,
): string | null {
  const formatted = formatScheduledPublishDisplay(iso, timeZone);
  if (!formatted) return null;
  return `${formatted} (${SCHEDULED_PUBLISH_TIME_ZONE_LABEL})`;
}

export function deriveScheduleStatus(page: ScheduleSourcePage): ScheduleStatus {
  if (page?.scheduled_publish_status === "failed") {
    const at = page.scheduled_publish_at ?? null;
    return {
      kind: "failed",
      at,
      display: scheduleDisplayLabel(at),
      error:
        page.scheduled_publish_error?.trim() ||
        "Scheduled publish failed. Save a new time to retry.",
    };
  }

  if (
    page?.scheduled_publish_status === "scheduled" &&
    page.scheduled_publish_at
  ) {
    const display = scheduleDisplayLabel(page.scheduled_publish_at);
    if (display) {
      return { kind: "scheduled", at: page.scheduled_publish_at, display };
    }
  }

  return { kind: "none" };
}
