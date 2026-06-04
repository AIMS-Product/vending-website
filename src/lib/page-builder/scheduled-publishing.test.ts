import { describe, expect, it } from "vitest";
import {
  SCHEDULED_PUBLISH_TIME_ZONE,
  formatDateTimeLocalInTimeZone,
  formatScheduledPublishDisplay,
  zonedDateTimeLocalToUtcIso,
} from "@/lib/page-builder/scheduled-publishing";

describe("scheduled publishing helpers", () => {
  it("converts admin Pacific Time input into UTC for storage", () => {
    expect(zonedDateTimeLocalToUtcIso("2026-06-03T09:30")).toBe(
      "2026-06-03T16:30:00.000Z",
    );
    expect(zonedDateTimeLocalToUtcIso("2026-01-03T09:30")).toBe(
      "2026-01-03T17:30:00.000Z",
    );
  });

  it("formats stored UTC timestamps back into the admin scheduling timezone", () => {
    expect(
      formatDateTimeLocalInTimeZone(
        "2026-06-03T16:30:00.000Z",
        SCHEDULED_PUBLISH_TIME_ZONE,
      ),
    ).toBe("2026-06-03T09:30");
    expect(formatScheduledPublishDisplay("2026-06-03T16:30:00.000Z")).toContain(
      "9:30 AM",
    );
  });

  it("rejects malformed datetime-local strings instead of guessing timezone", () => {
    expect(zonedDateTimeLocalToUtcIso("2026-06-03")).toBeNull();
    expect(zonedDateTimeLocalToUtcIso("not-a-date")).toBeNull();
  });

  it("rejects nonexistent local wall times during daylight saving transitions", () => {
    expect(zonedDateTimeLocalToUtcIso("2026-03-08T02:30")).toBeNull();
  });
});
