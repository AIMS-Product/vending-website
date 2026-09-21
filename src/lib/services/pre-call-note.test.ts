import { describe, expect, it } from "vitest";
import type { BriefingRow } from "./pre-call-briefing";
import { buildPreCallNoteHtml, PRE_CALL_NOTE_MARKER } from "./pre-call-note";

function row(engagement: Partial<BriefingRow["engagement"]>): BriefingRow {
  return {
    id: "b1",
    name: "Sam Rivera",
    email: "sam@example.com",
    calendar: "Lane 1",
    startAt: "2026-09-21T15:00:00Z",
    setBy: "Ari",
    unknownSession: false,
    engagement: {
      watchedCount: 0,
      totalVideos: 15,
      finishedCount: 0,
      videos: [],
      lastSeenAt: null,
      ...engagement,
    },
  };
}

describe("buildPreCallNoteHtml", () => {
  it("always carries the marker the sweep dedupes on", () => {
    expect(buildPreCallNoteHtml(row({}))).toContain(PRE_CALL_NOTE_MARKER);
    expect(
      buildPreCallNoteHtml(
        row({
          watchedCount: 1,
          videos: [{ embedId: "a", label: "Financing", percent: 80 }],
        }),
      ),
    ).toContain(PRE_CALL_NOTE_MARKER);
  });

  it("says plainly when nothing was opened", () => {
    expect(buildPreCallNoteHtml(row({}))).toContain("Nothing opened");
  });

  it("names the videos they got furthest through, at most three", () => {
    const html = buildPreCallNoteHtml(
      row({
        watchedCount: 4,
        finishedCount: 2,
        videos: [
          { embedId: "a", label: "What it costs", percent: 100 },
          { embedId: "b", label: "Financing", percent: 80 },
          { embedId: "c", label: "Locations", percent: 50 },
          { embedId: "d", label: "Earnings", percent: 25 },
        ],
      }),
    );

    expect(html).toContain("Watched 4 of 15");
    expect(html).toContain("2 most of the way through");
    expect(html).toContain("What it costs — 100%");
    expect(html).not.toContain("Earnings");
  });

  it("escapes a label so a member name cannot inject markup", () => {
    const html = buildPreCallNoteHtml(
      row({
        watchedCount: 1,
        videos: [
          {
            embedId: "a",
            label: '<img src=x onerror="alert(1)">',
            percent: 50,
          },
        ],
      }),
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
