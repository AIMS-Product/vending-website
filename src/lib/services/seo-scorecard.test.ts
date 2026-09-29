import { describe, expect, it } from "vitest";
import { positionBuckets, rankCounts } from "./seo-scorecard";

describe("seo scorecard", () => {
  it("buckets queries by impression-weighted position over the window", () => {
    const row = (
      query: string,
      day: string,
      impressions: number,
      position: number,
    ) => ({
      query,
      day,
      impressions,
      clicks: 0,
      position,
    });
    expect(
      positionBuckets(
        [
          row("a", "2026-09-01", 10, 2),
          row("a", "2026-09-02", 10, 4), // weighted 3.0: top 3
          row("b", "2026-09-01", 1, 5),
          row("c", "2026-09-01", 5, 15),
          row("d", "2026-09-01", 5, 40),
          row("e", "2026-08-01", 5, 1), // outside the window
        ],
        "2026-08-29",
        "2026-09-25",
      ),
    ).toEqual({ queries_top3: 1, queries_4_10: 1, queries_11_20: 1 });
  });

  it("counts only each keyword's newest snapshot", () => {
    const snap = (
      keyword: string,
      day: string,
      vp_position: number | null,
      aio = false,
      site = false,
      yt = false,
    ) => ({
      keyword,
      day,
      vp_position,
      ai_overview: aio,
      aio_cites_site: site,
      aio_cites_youtube: yt,
    });
    expect(
      rankCounts([
        snap("x", "2026-09-14", 2),
        snap("x", "2026-09-21", 12, true, false, true),
        snap("y", "2026-09-21", 3, true, true),
        snap("z", "2026-09-21", null),
      ]),
    ).toEqual({
      keywords_checked: 3,
      keywords_top10: 1,
      keywords_top3: 1,
      aio_keywords: 2,
      aio_cites_site: 1,
      aio_cites_youtube: 1,
    });
  });
});
