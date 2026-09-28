import { describe, expect, it } from "vitest";
import {
  addDays,
  evaluateTriggers,
  type PageDayRow,
  type QueryDayRow,
  type RankRow,
} from "./triggers";

const AS_OF = "2026-09-25";
const PAGE = "https://www.vendingpreneurs.com/news/best-vending-locations";

/** One row a day for `days` days ending `endOffset` days before AS_OF. */
function days(
  count: number,
  endOffset: number,
  row: (i: number) => Partial<PageDayRow>,
  page = PAGE,
): PageDayRow[] {
  return Array.from({ length: count }, (_, i) => ({
    day: addDays(AS_OF, -(endOffset + count - 1 - i)),
    page,
    impressions: 10,
    clicks: 0,
    position: 12,
    ...row(i),
  }));
}

const base = {
  asOf: AS_OF,
  queryDays: [] as QueryDayRow[],
  tracked: new Set<string>(),
  isBrand: (q: string) => q.includes("vendingpreneurs"),
  ranks: [] as RankRow[],
  keywordPage: new Map<string, string>(),
};

const codes = (hits: { code: number }[]) => hits.map((h) => h.code).sort();

describe("page triggers", () => {
  it("1. striking distance: position 4-10 and impressions up 20%+", () => {
    const pageDays = [
      ...days(28, 28, () => ({ impressions: 5, position: 7 })), // prior: 140
      ...days(28, 0, () => ({ impressions: 6, position: 7 })), // current: 168
      ...days(20, 56, () => ({ impressions: 1 })), // seen long ago
    ];
    const hits = evaluateTriggers({ ...base, pageDays });
    expect(hits.find((h) => h.code === 1)).toMatchObject({
      url: PAGE,
      priority: "high",
      evidence: { impressions28: 168, impressionsChangePct: 20 },
    });
  });

  it("stays silent under the 100-impression floor", () => {
    const pageDays = [
      ...days(28, 28, () => ({ impressions: 1, position: 7 })),
      ...days(28, 0, () => ({ impressions: 3, position: 7 })), // 84
    ];
    expect(evaluateTriggers({ ...base, pageDays })).toEqual([]);
  });

  it("leaves a page Google first showed under 6 weeks ago alone", () => {
    const pageDays = days(30, 0, () => ({ impressions: 20, position: 7 }));
    expect(evaluateTriggers({ ...base, pageDays })).toEqual([]);
  });

  it("2. plateau: flat position, impressions up 15%+ over six weeks", () => {
    const pageDays = [
      ...days(21, 21, () => ({ impressions: 4, position: 14 })), // 84
      ...days(21, 0, () => ({ impressions: 5, position: 14.5 })), // 105
      ...days(14, 42, () => ({ impressions: 4, position: 14 })),
    ];
    const hit = evaluateTriggers({ ...base, pageDays }).find(
      (h) => h.code === 2,
    );
    expect(hit?.evidence.impressionsChange3wPct).toBe(25);
  });

  it("3. slipping: 7-day position 3+ worse than two weeks ago", () => {
    const pageDays = [
      ...days(49, 7, () => ({ impressions: 5, position: 6 })),
      ...days(7, 0, () => ({ impressions: 5, position: 9.5 })),
    ];
    const hit = evaluateTriggers({ ...base, pageDays }).find(
      (h) => h.code === 3,
    );
    expect(hit).toMatchObject({ priority: "urgent" });
    expect(hit?.evidence).toMatchObject({
      position7d: 9.5,
      position7dTwoWeeksAgo: 6,
    });
  });

  it("4. declining: 14 days down 25%+ two weeks running", () => {
    // Impressions fall steadily: every 14-day window is well below the one before.
    const pageDays = days(70, 0, (i) => ({
      impressions: 70 - i,
      position: 12,
    }));
    const hit = evaluateTriggers({ ...base, pageDays }).find(
      (h) => h.code === 4,
    );
    expect(hit?.priority).toBe("high");
    expect(Number(hit?.evidence.impressions14dChangePct)).toBeLessThanOrEqual(
      -25,
    );
  });

  it("ignores the home page, legal pages and other hosts", () => {
    const busy = (page: string) =>
      days(56, 0, (i) => ({ impressions: i < 28 ? 5 : 10, position: 7 }), page);
    const pageDays = [
      ...busy("https://www.vendingpreneurs.com/"),
      ...busy("https://community.vendingpreneurs.com/x"),
      ...busy("https://www.vendingpreneurs.com/privacy"),
    ];
    expect(evaluateTriggers({ ...base, pageDays })).toEqual([]);
  });
});

describe("5. new opportunity", () => {
  const q = (
    query: string,
    impressions: number,
    endOffset: number,
  ): QueryDayRow[] =>
    days(28, endOffset, () => ({ impressions })).map((r) => ({ ...r, query }));

  it("fires on an untracked, non-brand query up 50%+ with 50+ impressions", () => {
    const queryDays = [
      ...q("vending machine items", 1, 28),
      ...q("vending machine items", 2, 0),
      ...q("vendingpreneurs login", 5, 0),
      ...q("types of vending machines", 5, 0),
    ];
    const hits = evaluateTriggers({
      ...base,
      pageDays: [],
      queryDays,
      tracked: new Set(["types of vending machines"]),
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      code: 5,
      subject: "vending machine items",
      url: PAGE,
      evidence: { impressions28: 56, impressionsChangePct: 100 },
    });
  });
});

describe("rank triggers", () => {
  const rank = (day: string, extra: Partial<RankRow>): RankRow => ({
    day,
    keyword: "types of vending machines",
    vp_position: 8,
    ai_overview: false,
    aio_cites_site: false,
    aio_cites_youtube: false,
    top10: [],
    ...extra,
  });
  const keywordPage = new Map([
    [
      "types of vending machines",
      "https://www.vendingpreneurs.com/resources/types-of-vending-machines",
    ],
  ]);

  it("3 from DataForSEO, 6 when the AI Overview skips VP, 7 on a stale top 3", () => {
    const hits = evaluateTriggers({
      ...base,
      pageDays: [],
      keywordPage,
      ranks: [
        rank("2026-09-07", { vp_position: 8 }),
        rank("2026-09-21", {
          vp_position: 12,
          ai_overview: true,
          aio_cites_youtube: true,
          top10: [
            {
              rank: 1,
              domain: "old.com",
              url: "u",
              date: "2023-01-02 00:00:00 +00:00",
            },
            {
              rank: 2,
              domain: "new.com",
              url: "u",
              date: "2026-06-01 00:00:00 +00:00",
            },
          ],
        }),
      ],
    });
    expect(codes(hits)).toEqual([3, 6, 7]);
    expect(hits.find((h) => h.code === 6)?.evidence.citesVpYouTube).toBe(true);
    expect(hits.find((h) => h.code === 7)?.evidence.staleTop3).toBe("old.com");
    expect(
      hits.every((h) => h.url === keywordPage.get("types of vending machines")),
    ).toBe(true);
  });

  it("stays quiet when VP is cited and already top 3", () => {
    const hits = evaluateTriggers({
      ...base,
      pageDays: [],
      ranks: [
        rank("2026-09-21", {
          vp_position: 2,
          ai_overview: true,
          aio_cites_site: true,
          top10: [
            {
              rank: 1,
              domain: "old.com",
              url: "u",
              date: "2020-01-01 00:00:00 +00:00",
            },
          ],
        }),
      ],
    });
    expect(hits).toEqual([]);
  });
});
