import { describe, expect, it } from "vitest";
import {
  formatRevisionDateTime,
  revisionBlockStats,
  revisionTypeLabel,
} from "./revision-display";

describe("revisionTypeLabel", () => {
  // Every revision_type the schema CHECK allows must get a human label
  // (autosave, manual_save, publish, rollback, ai_insert).
  it("labels all five revision types with marketer-facing wording", () => {
    expect(revisionTypeLabel("publish")).toBe("Published");
    expect(revisionTypeLabel("manual_save")).toBe("Manual save");
    expect(revisionTypeLabel("autosave")).toBe("Autosave");
    expect(revisionTypeLabel("rollback")).toBe("Restored");
    expect(revisionTypeLabel("ai_insert")).toBe("AI edit");
  });

  it("falls back to a readable label for unknown types without exposing raw underscores", () => {
    expect(revisionTypeLabel("something_new")).toBe("Something new");
  });
});

describe("formatRevisionDateTime", () => {
  // Root cause of the review's AM/PM mismatch: the revision panel forced UTC
  // while the editor/detail page used an unspecified (local) zone. The shared
  // formatter renders the business's Pacific Time consistently. 2026-06-03
  // 16:30 UTC is 9:30 AM Pacific (PDT).
  it("renders an ISO timestamp in Pacific Time, 12-hour with AM/PM", () => {
    const out = formatRevisionDateTime("2026-06-03T16:30:00.000Z");
    expect(out).toMatch(/9:30\s?AM/);
    expect(out).toContain("Jun");
  });

  it("is deterministic regardless of the runtime zone (no naive local time)", () => {
    // A winter UTC midnight is the previous evening in Pacific (PST, UTC-8).
    const out = formatRevisionDateTime("2026-01-01T00:00:00.000Z");
    expect(out).toMatch(/4:00\s?PM/);
    expect(out).toContain("Dec 31");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatRevisionDateTime("not-a-date")).toBe("");
  });
});

describe("revisionBlockStats", () => {
  it("counts blocks and words from a content snapshot", () => {
    const snapshot = {
      version: 1,
      sections: [
        {
          id: "s1",
          columns: [
            {
              id: "c1",
              blocks: [
                { id: "b1", type: "hero", props: { heading: "Two words" } },
                { id: "b2", type: "rich_text", props: { heading: "One" } },
              ],
            },
          ],
        },
      ],
    };
    const stats = revisionBlockStats(snapshot);
    expect(stats.blockCount).toBe(2);
    expect(stats.wordCount).toBeGreaterThanOrEqual(3);
  });

  it("returns zero counts for an empty or invalid snapshot", () => {
    expect(revisionBlockStats(null).blockCount).toBe(0);
    expect(revisionBlockStats({ version: 1, sections: [] }).blockCount).toBe(0);
    expect(revisionBlockStats("garbage").wordCount).toBe(0);
  });
});
