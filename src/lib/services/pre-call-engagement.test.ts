import { describe, expect, it } from "vitest";
import { preCallVideos } from "@/lib/content/pre-call-resources";
import {
  sessionIdFromLeadMetadata,
  summariseEngagement,
} from "./pre-call-engagement";

const hero = preCallVideos[0];
const second = preCallVideos[1];

describe("summariseEngagement", () => {
  it("counts watched against the page's own video count", () => {
    const summary = summariseEngagement([
      {
        embed_id: hero.embedId,
        max_percent: 100,
        last_seen_at: "2026-09-21T10:00:00Z",
      },
      {
        embed_id: second.embedId,
        max_percent: 25,
        last_seen_at: "2026-09-21T10:05:00Z",
      },
    ]);

    expect(summary.watchedCount).toBe(2);
    expect(summary.totalVideos).toBe(preCallVideos.length);
    // 25% is opened, not watched.
    expect(summary.finishedCount).toBe(1);
    expect(summary.lastSeenAt).toBe("2026-09-21T10:05:00Z");
  });

  it("labels each video for a reader, furthest first", () => {
    const summary = summariseEngagement([
      {
        embed_id: second.embedId,
        max_percent: 50,
        last_seen_at: "2026-09-21T10:00:00Z",
      },
      {
        embed_id: hero.embedId,
        max_percent: 75,
        last_seen_at: "2026-09-21T10:00:00Z",
      },
    ]);

    expect(summary.videos.map((v) => v.label)).toEqual([
      hero.label,
      second.label,
    ]);
    expect(summary.videos[0].label).not.toBe(hero.embedId);
  });

  it("keeps a video that has since left the page, labelled by its id", () => {
    const summary = summariseEngagement([
      {
        embed_id: "retired-embed",
        max_percent: 100,
        last_seen_at: "2026-09-21T10:00:00Z",
      },
    ]);

    expect(summary.watchedCount).toBe(1);
    expect(summary.videos[0].label).toBe("retired-embed");
  });

  it("is empty for a session with no rows", () => {
    expect(summariseEngagement([]).watchedCount).toBe(0);
  });
});

describe("sessionIdFromLeadMetadata", () => {
  it("reads the id the lead pipeline stores", () => {
    expect(
      sessionIdFromLeadMetadata({
        attribution_session: { vp_session_id: "vp-123" },
      }),
    ).toBe("vp-123");
  });

  it("is null for every shape that is not that", () => {
    expect(sessionIdFromLeadMetadata(null)).toBeNull();
    expect(sessionIdFromLeadMetadata({})).toBeNull();
    expect(sessionIdFromLeadMetadata([])).toBeNull();
    expect(
      sessionIdFromLeadMetadata({ attribution_session: "vp-123" }),
    ).toBeNull();
    expect(
      sessionIdFromLeadMetadata({
        attribution_session: { vp_session_id: "  " },
      }),
    ).toBeNull();
  });
});
