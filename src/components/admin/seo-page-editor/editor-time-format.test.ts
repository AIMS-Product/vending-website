import { describe, expect, it } from "vitest";

import { formatRevisionDateTime } from "@/app/admin/pages/[id]/revisions/revision-display";
import { formatPacificDateTime } from "@/lib/page-builder/datetime-format";

// N21: the editor's save-time displays (top rail + mobile action bar) must
// render in the SAME Pacific-anchored format as the revision surfaces. This
// test pins a fixed instant and proves (a) the editor formatter and the
// revision formatter produce identical output, and (b) the output is
// Pacific-anchored (carries a PDT/PST zone label), not runtime-local.

// A summer instant: 2026-06-10T22:45:00Z = 3:45 PM PDT (Pacific, UTC-7).
const FIXED_ISO = "2026-06-10T22:45:00.000Z";

describe("editor save-time formatting (N21)", () => {
  it("matches the revision surfaces' formatter exactly for a fixed instant", () => {
    expect(formatPacificDateTime(FIXED_ISO)).toBe(
      formatRevisionDateTime(FIXED_ISO),
    );
  });

  it("renders the Pacific instant with a Pacific zone label", () => {
    const output = formatPacificDateTime(FIXED_ISO);
    expect(output).toContain("3:45 PM");
    expect(output).toMatch(/PDT|PST/);
  });

  it("reproduces the pre-N21 divergence: a bare local time-only format differs", () => {
    // The old rail/mobile-bar helpers used `toLocaleTimeString` with NO
    // timeZone, yielding a zone-less, date-less string. Pin the runtime to a
    // non-Pacific zone to make the divergence deterministic.
    const previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const legacyLocalTimeOnly = new Date(FIXED_ISO).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "2-digit" },
      );
      // Eastern renders 6:45 PM for this instant — not the Pacific 3:45 PM,
      // and with no date or zone label. This is exactly the inconsistency N21
      // removes by routing both surfaces through formatPacificDateTime.
      expect(legacyLocalTimeOnly).not.toBe(formatPacificDateTime(FIXED_ISO));
    } finally {
      process.env.TZ = previousTz;
    }
  });

  it("returns an empty string for an invalid timestamp", () => {
    expect(formatPacificDateTime("not-a-date")).toBe("");
  });
});
