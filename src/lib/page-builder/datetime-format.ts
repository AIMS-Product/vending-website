import { SCHEDULED_PUBLISH_TIME_ZONE } from "@/lib/page-builder/scheduled-publishing";

// N16 / N21: ONE Pacific-anchored date+time formatter shared by the revision
// surfaces (list panel + detail page) and the editor's own save-time displays
// (top rail "Saved automatically" hint, mobile action bar). For a Pacific-Time
// business, formatting in UTC or runtime-local renders hours apart and flips
// AM/PM between surfaces; anchoring to the same zone as the scheduled-publish
// UI keeps every timestamp consistent. Lives in a neutral lib location so both
// `src/components/...` and `src/app/...` can depend on it without a component
// reaching into a route folder.
const pacificDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: SCHEDULED_PUBLISH_TIME_ZONE,
  timeZoneName: "short",
});

export function formatPacificDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return pacificDateTimeFormatter.format(date);
}

// Date-only variant for surfaces that show calendar dates (redirect created-at,
// publish panel "Last updated"/"Published"). Anchored to the same Pacific zone
// so a record created in the Pacific evening never displays as the next day.
const pacificDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: SCHEDULED_PUBLISH_TIME_ZONE,
});

export function formatPacificDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return pacificDateFormatter.format(date);
}
