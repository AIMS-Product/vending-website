import { describe, expect, it } from "vitest";
import { formatDateTimeLocalInTimeZone } from "@/lib/page-builder/scheduled-publishing";
import { deriveScheduleStatus, scheduleDisplayLabel } from "./schedule-status";

// Regression lock for issue I2 part (a): the schedule datetime-local field is
// hydrated from page.scheduled_publish_at via this baseline derivation (used as
// the field's defaultValue in GovernanceFields). The round-trip was already
// correct on current code; this guards it against regressing to the empty
// re-render the UX review reported.
describe("schedule field hydration (regression lock)", () => {
  it("derives the Pacific datetime-local baseline from the stored UTC instant", () => {
    // 16:00Z == 09:00 Pacific Daylight Time.
    expect(formatDateTimeLocalInTimeZone("2026-06-12T16:00:00.000Z")).toBe(
      "2026-06-12T09:00",
    );
  });

  it("yields an empty baseline only when no schedule is stored", () => {
    expect(formatDateTimeLocalInTimeZone(null)).toBe("");
    expect(formatDateTimeLocalInTimeZone(undefined)).toBe("");
  });
});

describe("scheduleDisplayLabel", () => {
  it("formats a UTC instant in Pacific Time and appends the human label", () => {
    // 2026-06-12T16:00:00Z is 09:00 in Pacific Daylight Time (UTC-7).
    const label = scheduleDisplayLabel("2026-06-12T16:00:00.000Z");
    expect(label).toContain("Jun 12, 2026");
    expect(label).toContain("9:00");
    expect(label).toContain("PDT");
    expect(label).toContain("(Pacific Time)");
  });

  it("returns null for an empty value", () => {
    expect(scheduleDisplayLabel(null)).toBeNull();
    expect(scheduleDisplayLabel("")).toBeNull();
  });
});

describe("deriveScheduleStatus", () => {
  it("returns a scheduled status with a Pacific display string", () => {
    const status = deriveScheduleStatus({
      scheduled_publish_status: "scheduled",
      scheduled_publish_at: "2026-06-12T16:00:00.000Z",
      scheduled_publish_error: null,
    });
    expect(status.kind).toBe("scheduled");
    if (status.kind === "scheduled") {
      expect(status.at).toBe("2026-06-12T16:00:00.000Z");
      expect(status.display).toContain("(Pacific Time)");
    }
  });

  it("returns a failed status with the error message visible", () => {
    const status = deriveScheduleStatus({
      scheduled_publish_status: "failed",
      scheduled_publish_at: "2026-06-12T16:00:00.000Z",
      scheduled_publish_error: "Slug already taken by a live page.",
    });
    expect(status.kind).toBe("failed");
    if (status.kind === "failed") {
      expect(status.error).toBe("Slug already taken by a live page.");
      expect(status.display).toContain("(Pacific Time)");
    }
  });

  it("supplies a default error message when failed status has no error text", () => {
    const status = deriveScheduleStatus({
      scheduled_publish_status: "failed",
      scheduled_publish_at: null,
      scheduled_publish_error: null,
    });
    expect(status.kind).toBe("failed");
    if (status.kind === "failed") {
      expect(status.error).toMatch(/failed/i);
      expect(status.display).toBeNull();
    }
  });

  it("returns none for draft, cancelled, published, or missing scheduler state", () => {
    expect(deriveScheduleStatus(null).kind).toBe("none");
    expect(
      deriveScheduleStatus({ scheduled_publish_status: "cancelled" }).kind,
    ).toBe("none");
    expect(
      deriveScheduleStatus({ scheduled_publish_status: "published" }).kind,
    ).toBe("none");
    // "scheduled" with no timestamp is not a usable scheduled state.
    expect(
      deriveScheduleStatus({
        scheduled_publish_status: "scheduled",
        scheduled_publish_at: null,
      }).kind,
    ).toBe("none");
  });
});
