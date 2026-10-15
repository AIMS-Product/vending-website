import { describe, expect, it } from "vitest";
import { buildSiteVideoRows, canonicalViews } from "./site-video-report";

const anthony = "fsRX7K_Hg08";
const intro = "t7gH_0l6bVqv1cOb"; // Vidalytics pre-call intro

const view = (
  embed_id: string,
  page_path: string,
  max_percent: number,
  vp_session_id = `s-${Math.random()}`,
) => ({
  vp_session_id,
  embed_id,
  page_path,
  max_percent,
});
const play = (
  location_type: string,
  views: number,
  engaged_views: number | null,
  minutes_watched: number,
) => ({
  video_id: anthony,
  location_type,
  views,
  engaged_views,
  minutes_watched,
});

describe("buildSiteVideoRows", () => {
  it("counts our plays per page and keeps YouTube's embedded and on-YouTube numbers apart", () => {
    const [row] = buildSiteVideoRows({
      views: [
        view(anthony, "/masterclass", 1),
        view(anthony, "/masterclass", 60),
        view(anthony, "/case-studies/anthony-kolodziej", 100),
      ],
      playback: [
        play("EMBEDDED", 9, 4, 30),
        play("EMBEDDED", 3, 2, 10),
        play("WATCH", 200, 150, 900),
        play("BROWSE", 50, 40, 100),
      ],
      embedPages: [
        {
          video_id: anthony,
          page: "https://www.vendingpreneurs.com/masterclass",
          views: 10,
        },
        {
          video_id: anthony,
          page: "https://someone-else.example/blog",
          views: 2,
        },
      ],
      titles: new Map([
        [anthony, "How He Built a $102K/Month Vending Business"],
      ]),
      youtubeConnected: true,
    });

    expect(row?.label).toBe("How He Built a $102K/Month Vending Business");
    expect(row?.player).toBe("YouTube");
    expect(row?.site).toEqual({
      played: 3,
      reached25: 2,
      reached50: 2,
      reached75: 1,
      finished: 1,
    });
    expect(row?.pages.map((page) => [page.path, page.played])).toEqual([
      ["/masterclass", 2],
      ["/case-studies/anthony-kolodziej", 1],
    ]);
    expect(row?.youtube).toEqual({
      embeddedEngaged: 6,
      embeddedViews: 12,
      embeddedMinutes: 40,
      onYouTubeEngaged: 190,
      onYouTubeViews: 250,
      onYouTubeMinutes: 1000,
      // Only our domain: other sites embedding the video are not our plays.
      ourEmbedPages: [
        { page: "https://www.vendingpreneurs.com/masterclass", views: 10 },
      ],
    });
  });

  it("says engaged views are unknown rather than zero when YouTube did not send them", () => {
    const [row] = buildSiteVideoRows({
      views: [],
      playback: [play("EMBEDDED", 5, null, 7)],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: true,
    });
    expect(row?.youtube?.embeddedEngaged).toBeNull();
    expect(row?.youtube?.embeddedViews).toBe(5);
    expect(row?.site.played).toBe(0);
  });

  it("labels a Vidalytics video by its pre-call name and gives it no YouTube numbers", () => {
    const [row] = buildSiteVideoRows({
      views: [view(intro, "/pre-call-resources", 30)],
      playback: [],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: true,
    });
    expect(row?.label).toBe("Pre-call: Intro");
    expect(row?.player).toBe("Vidalytics");
    expect(row?.youtube).toBeNull();
  });

  it("leaves YouTube numbers off until the connector's tables exist", () => {
    const [row] = buildSiteVideoRows({
      views: [view(anthony, "/masterclass", 1)],
      playback: [],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: false,
    });
    expect(row?.youtube).toBeNull();
  });

  it("estimates views on YouTube as Metricool's total minus our plays", () => {
    const [youtube, vidalytics] = buildSiteVideoRows({
      views: [
        view(anthony, "/masterclass", 1),
        view(anthony, "/masterclass", 1),
        view(intro, "/pre-call-resources", 30),
      ],
      playback: [],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: false,
      totals: new Map([[anthony, 120]]),
    });
    expect(youtube?.youtubeTotal).toBe(120);
    expect(youtube?.onYouTubeEstimate).toBe(118);
    expect(vidalytics?.youtubeTotal).toBeNull();
    expect(vidalytics?.onYouTubeEstimate).toBeNull();

    const [unseen] = buildSiteVideoRows({
      views: [view(anthony, "/masterclass", 1), view(anthony, "/x", 1)],
      playback: [],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: false,
      totals: new Map([[anthony, 1]]),
    });
    // Metricool lags our plays; never a negative estimate.
    expect(unseen?.onYouTubeEstimate).toBe(0);
  });

  it("lists the most played videos first", () => {
    const rows = buildSiteVideoRows({
      views: [
        view(intro, "/pre-call-resources", 30),
        view(anthony, "/masterclass", 1),
        view(anthony, "/masterclass", 1),
      ],
      playback: [],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: false,
    });
    expect(rows.map((row) => row.videoId)).toEqual([anthony, intro]);
  });
});

describe("canonicalViews", () => {
  it("reads a story's Vidalytics plays as its YouTube video, once per browser", () => {
    const rows = canonicalViews([
      // Matthew Morrison: Vidalytics before the swap, YouTube after.
      view("pW5bzDBuhVIVe6fD", "/pre-call-resources", 75, "a"),
      view("tfjgFj0BLgI", "/pre-call-resources", 25, "a"),
      view("pW5bzDBuhVIVe6fD", "/pre-call-resources", 50, "b"),
      // A meta testimonial's Vidalytics copy.
      view("JcjYb4jILP6zsniI", "/masterclass-replay-meta", 25, "c"),
    ]);
    expect(
      rows.map((row) => [row.embed_id, row.vp_session_id, row.max_percent]),
    ).toEqual([
      ["tfjgFj0BLgI", "a", 75],
      ["tfjgFj0BLgI", "b", 50],
      ["U7KKbZHqBvg", "c", 25],
    ]);
  });

  it("names a video no page plays any more instead of showing a bare id", () => {
    const [row] = buildSiteVideoRows({
      views: [view("IaV_mwvewT7n98YX", "/pre-call-resources", 30)],
      playback: [],
      embedPages: [],
      titles: new Map(),
      youtubeConnected: false,
    });
    expect(row?.label).toBe("Retired video IaV_mwvewT7n98YX");
  });
});
