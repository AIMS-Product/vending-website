import { describe, expect, it } from "vitest";
import {
  EVENT_TYPE_ENTRIES,
  classifyEventType,
} from "@/lib/services/calendly-event-class";
import {
  callsByChannel,
  creditChannel,
  readBookedMetric,
  type BookingRow,
  type FunnelRow,
} from "@/lib/services/booked-metrics";

/**
 * Channel credit and the booked-on invariant, characterized. booked-metrics.test.ts
 * pins one worked example; these cover each rung of `creditChannel` on its own
 * and hold the grid against `newBookedOn` over randomized books, because the
 * Goals page prints both and they are required to agree.
 */

type Funnels = Parameters<typeof creditChannel>[1];
const noFunnels: Funnels = new Map();
const sites = (entries: Array<[string, string]>) => new Map(entries);

function pick(
  email: string | null,
  utm: string | null = null,
  medium: string | null = null,
) {
  return { inviteeEmail: email, utmSource: utm, utmMedium: medium };
}

describe("creditChannel: the order of evidence", () => {
  it("takes Close's funnel over the booking tag and over the website form", () => {
    const result = creditChannel(
      pick("a@example.com", "youtube"),
      new Map([["a@example.com", "Internal Webinar"]]),
      sites([["a@example.com", "Instagram"]]),
    );

    expect(result).toEqual({ key: "webinar", via: "close" });
  });

  it("takes the booking tag over the website form when Close has no funnel", () => {
    const result = creditChannel(
      pick("a@example.com", "youtube"),
      noFunnels,
      sites([["a@example.com", "Instagram"]]),
    );

    expect(result).toEqual({ key: "youtube", via: "booking-tag" });
  });

  it("takes the website form last", () => {
    const result = creditChannel(
      pick("a@example.com"),
      noFunnels,
      sites([["a@example.com", "Instagram"]]),
    );

    expect(result).toEqual({ key: "instagram", via: "site-form" });
  });

  it("says none, never a guess, when there is no evidence at all", () => {
    expect(creditChannel(pick("a@example.com"), noFunnels, undefined)).toEqual({
      key: null,
      via: "none",
    });
    expect(creditChannel(pick(null), noFunnels, sites([]))).toEqual({
      key: null,
      via: "none",
    });
  });

  it("treats a blank or whitespace Close funnel as no funnel, so the tag still counts", () => {
    for (const funnel of ["", "   ", null]) {
      const result = creditChannel(
        pick("a@example.com", "webinar"),
        new Map([["a@example.com", funnel]]),
        undefined,
      );

      expect(result).toEqual({ key: "webinar", via: "booking-tag" });
    }
  });

  it("ignores a whitespace-only booking tag", () => {
    expect(
      creditChannel(pick("a@example.com", "   "), noFunnels, undefined),
    ).toEqual({ key: null, via: "none" });
  });

  it("matches the invitee's email in Close ignoring case and padding", () => {
    const result = creditChannel(
      pick("  A@Example.COM "),
      new Map([["a@example.com", "YouTube"]]),
      undefined,
    );

    expect(result).toEqual({ key: "youtube", via: "close" });
  });
});

describe("creditChannel: mapping onto Goals page channels", () => {
  it.each([
    ["YouTube", "youtube"],
    ["Webinar", "webinar"],
    ["Instagram", "instagram"],
    ["Instagram DM", "instagram"],
    ["Newsletter", "newsletter"],
    ["Website", "website"],
    // Chatbot captures happen on the site.
    ["Chatbot", "website"],
  ])("sends the website channel %s to %s", (siteChannel, goalKey) => {
    const result = creditChannel(
      pick("a@example.com"),
      noFunnels,
      sites([["a@example.com", siteChannel]]),
    );

    expect(result).toEqual({ key: goalKey, via: "site-form" });
  });

  it("keeps 'Unknown' unattributed (key null) rather than filing it under Other", () => {
    expect(
      creditChannel(
        pick("a@example.com"),
        noFunnels,
        sites([["a@example.com", "Unknown"]]),
      ),
    ).toEqual({ key: null, via: "site-form" });
  });

  it("files an unplanned website channel under Other funnels", () => {
    expect(
      creditChannel(
        pick("a@example.com"),
        noFunnels,
        sites([["a@example.com", "Meta Ads"]]),
      ),
    ).toEqual({ key: "other", via: "site-form" });
  });

  it("files a Close funnel the plan does not name under Other funnels", () => {
    expect(
      creditChannel(
        pick("a@example.com"),
        new Map([["a@example.com", "LTF - Quiz Funnel"]]),
        undefined,
      ),
    ).toEqual({ key: "other", via: "close" });
  });

  it("sends Lane 2 funnels to lane-2, which the grid then drops", () => {
    for (const funnel of ["Sales Reactivation", "Reactivation Scrapers"]) {
      expect(
        creditChannel(
          pick("a@example.com"),
          new Map([["a@example.com", funnel]]),
          undefined,
        ).key,
      ).toBe("lane-2");
    }
  });

  it("reads a paid medium on a google or meta tag as the ad channel, which the plan files under Other", () => {
    expect(
      creditChannel(
        pick("a@example.com", "google", "cpc"),
        noFunnels,
        undefined,
      ),
    ).toEqual({ key: "other", via: "booking-tag" });
    // The same tag with no paid medium is not an ad click.
    const organic = creditChannel(
      pick("a@example.com", "google", "organic"),
      noFunnels,
      undefined,
    );
    expect(organic.via).toBe("booking-tag");
  });

  it("maps a placeholder tag to a null key but still marks it as tag-credited", () => {
    // "_____" is a link someone built with the template unfilled in.
    expect(
      creditChannel(pick("a@example.com", "_____"), noFunnels, undefined),
    ).toEqual({ key: null, via: "booking-tag" });
  });
});

// ---------------------------------------------------------------------------
// The invariant, over randomized books.

/** Small deterministic PRNG so a failure reproduces from the seed alone. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEW_ENTRY = EVENT_TYPE_ENTRIES.find((entry) => entry.class === "new")!;
const FOLLOW_UP = EVENT_TYPE_ENTRIES.find(
  (entry) => entry.class === "follow_up",
)!;
const OTHER_CLASSES = EVENT_TYPE_ENTRIES.filter(
  (entry) => entry.class !== "new" && entry.class !== "follow_up",
);

const EMAILS = Array.from(
  { length: 14 },
  (_, index) => `p${index}@example.com`,
);
const FUNNEL_POOL: Array<string | null> = [
  "Website",
  "YouTube",
  "Internal Webinar",
  "Instagram",
  "Newsletter",
  "Sales Reactivation",
  "Reactivation Scrapers",
  "Reactivation Email",
  "LTF - Quiz Funnel",
  "",
  "  ",
  null,
];
const UTM_POOL: Array<[string | null, string | null]> = [
  [null, null],
  ["youtube", null],
  ["webinar", null],
  ["google", "cpc"],
  ["meta", "paid_social"],
  ["chatbot", null],
  ["_____", null],
  ["some-new-campaign", null],
  ["   ", null],
];
const SITE_POOL = [
  "YouTube",
  "Webinar",
  "Instagram",
  "Instagram DM",
  "Newsletter",
  "Website",
  "Chatbot",
  "Unknown",
  "Meta Ads",
];

const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"];

function randomBook(seed: number) {
  const random = mulberry32(seed);
  const choose = <T>(items: readonly T[]): T =>
    items[Math.floor(random() * items.length)];
  const hours = (days: number, hour: number) =>
    new Date(Date.UTC(2026, 8, 14 + days, hour)).toISOString();

  const bookings: BookingRow[] = Array.from({ length: 80 }, () => {
    const kind = random();
    const entry =
      kind < 0.6 ? NEW_ENTRY : kind < 0.75 ? FOLLOW_UP : choose(OTHER_CLASSES);
    const unreviewed = random() < 0.08;
    const [utmSource, utmMedium] = choose(UTM_POOL);
    return {
      inviteeEmail: random() < 0.05 ? null : choose(EMAILS),
      status: random() < 0.2 ? "canceled" : "booked",
      eventName: unreviewed ? "Never Reviewed Calendar" : entry.name,
      eventTypeUri: unreviewed ? null : (entry.eventTypeUris[0] ?? null),
      bookedAt:
        random() < 0.03
          ? null
          : hours(Math.floor(random() * 4), Math.floor(random() * 24)),
      eventStartAt: hours(Math.floor(random() * 7), Math.floor(random() * 24)),
      utmSource,
      utmMedium,
    };
  });
  const funnels: FunnelRow[] = EMAILS.filter(() => random() < 0.6).map(
    (email) => ({
      email: random() < 0.2 ? email.toUpperCase() : email,
      funnel: choose(FUNNEL_POOL),
      firstSalesCallBookedDate: null,
    }),
  );
  const siteChannels = new Map(
    EMAILS.filter(() => random() < 0.4).map(
      (email) => [email, choose(SITE_POOL)] as const,
    ),
  );
  return { bookings, funnels, siteChannels, timeZone: "America/New_York" };
}

describe("callsByChannel invariants over randomized books", () => {
  const seeds = Array.from({ length: 40 }, (_, index) => 1000 + index);

  it.each(seeds)(
    "booked-on: each day's total equals newBookedOn, and rows add up (seed %i)",
    (seed) => {
      const book = randomBook(seed);
      const grid = callsByChannel(book, DAYS, "booked-on");

      for (const [index, day] of DAYS.entries()) {
        const pace = readBookedMetric("newBookedOn", { ...book, day }).value;
        expect(grid.totals[index], `${day} seed ${seed}`).toBe(pace);
        expect(
          grid.channels.reduce((sum, row) => sum + row.counts[index], 0),
        ).toBe(grid.totals[index]);
      }
    },
  );

  it.each(seeds)(
    "never credits Lane 2 and never prints an empty channel row (seed %i)",
    (seed) => {
      const book = randomBook(seed);

      for (const basis of ["booked-on", "lands-on"] as const) {
        const grid = callsByChannel(book, DAYS, basis);

        expect(grid.channels.map((row) => row.key)).not.toContain("lane-2");
        for (const row of grid.channels) {
          expect(row.counts.some((count) => count > 0)).toBe(true);
          expect(
            row.counts.every((count) => Number.isInteger(count) && count >= 0),
          ).toBe(true);
        }
      }
    },
  );

  it.each(seeds)(
    "lands-on: widening the window adds only later days and stays within the live new-call population (seed %i)",
    (seed) => {
      const book = randomBook(seed);
      const landsOn = callsByChannel(book, DAYS, "lands-on");
      const allDays = [...DAYS, "2026-09-18", "2026-09-19", "2026-09-20"];
      const wide = callsByChannel(book, allDays, "lands-on");

      // Widening the window only ever adds calls.
      DAYS.forEach((_, index) => {
        expect(wide.totals[index]).toBe(landsOn.totals[index]);
      });

      // Upper bound: live, new, reviewed bookings (Lane 2 only lowers it).
      const eligible = book.bookings.filter(
        (row) =>
          row.status !== "canceled" &&
          classifyEventType(row.eventTypeUri, row.eventName).reviewed &&
          classifyEventType(row.eventTypeUri, row.eventName).class === "new",
      );
      const landing = eligible.length;
      expect(wide.totals.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(
        landing,
      );
    },
  );

  it.each(seeds)(
    "reports tag credit and unreviewed holds consistently (seed %i)",
    (seed) => {
      const book = randomBook(seed);
      const grid = callsByChannel(book, DAYS, "booked-on");
      const total = grid.totals.reduce((a, b) => a + b, 0);

      expect(grid.creditedFromTags).toBeLessThanOrEqual(total);
      // Each held-out calendar name stands for at least one held-out booking.
      expect(grid.unreviewedNames.length).toBeLessThanOrEqual(grid.unreviewed);
      expect(grid.unreviewedNames).toEqual([...grid.unreviewedNames].sort());
      // The held-out calendars are never silently counted.
      if (grid.unreviewed === 0) expect(grid.unreviewedNames).toEqual([]);
    },
  );
});
