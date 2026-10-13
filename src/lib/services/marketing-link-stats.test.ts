import { describe, expect, it } from "vitest";
import { buildLinkStats } from "@/lib/services/marketing-link-stats";

const tags = {
  utm_source: "podcast",
  utm_medium: "organic",
  utm_campaign: "mh-podcast",
  utm_content: "side-hustle-pro",
  utm_term: "book-call",
};

const link = { id: "a", bitly_id: null, bitly_url: null, ...tags };

describe("buildLinkStats", () => {
  it("credits leads, booked calls and calendar bookings that carried all five tags", () => {
    const stats = buildLinkStats({
      links: [link],
      leads: [
        {
          ...tags,
          created_at: "2026-10-01T00:00:00Z",
          call_booked_at: "2026-10-02",
        },
        {
          ...tags,
          utm_source: "PODCAST",
          created_at: "2026-10-05T00:00:00Z",
          call_booked_at: null,
        },
        // Same tags but a different destination is a different link.
        {
          ...tags,
          utm_term: "apply",
          created_at: "2026-10-06T00:00:00Z",
          call_booked_at: null,
        },
      ],
      bookings: [
        { ...tags, invitee_email: "a@x.com", status: "booked" },
        { ...tags, invitee_email: "A@x.com ", status: "booked" },
        { ...tags, invitee_email: "b@x.com", status: "canceled" },
      ],
      clicks: [],
    }).get("a");

    expect(stats).toEqual({
      leads: 2,
      booked: 1,
      calendarBookings: 1,
      clicks: null,
      lastLeadAt: "2026-10-05T00:00:00Z",
    });
  });

  it("reads clicks by bitly id, falling back to the short URL", () => {
    const stats = buildLinkStats({
      links: [
        {
          ...link,
          id: "yt",
          bitly_url: "https://booking.vendingpreneurs.com/yt-1",
        },
        { ...link, id: "none", utm_content: "other" },
      ],
      leads: [],
      bookings: [],
      clicks: [
        { bitly_id: "booking.vendingpreneurs.com/yt-1", clicks: 4 },
        { bitly_id: "booking.vendingpreneurs.com/yt-1", clicks: 3 },
      ],
    });
    expect(stats.get("yt")?.clicks).toBe(7);
    expect(stats.get("none")?.clicks).toBeNull();
  });

  it("matches an imported row whose missing tags are stored as empty strings", () => {
    const stats = buildLinkStats({
      links: [{ ...link, utm_term: "", utm_content: "" }],
      leads: [
        {
          ...tags,
          utm_term: null,
          utm_content: null,
          created_at: "2026-10-01T00:00:00Z",
          call_booked_at: null,
        },
      ],
      bookings: [],
      clicks: [],
    });
    expect(stats.get("a")?.leads).toBe(1);
  });

  it('matches a booking whose link template left "_____" in a tag', () => {
    const stats = buildLinkStats({
      links: [{ ...link, utm_term: "" }],
      leads: [],
      bookings: [
        {
          ...tags,
          utm_term: "_____",
          invitee_email: "a@x.com",
          status: "booked",
        },
      ],
      clicks: [],
    });
    expect(stats.get("a")?.calendarBookings).toBe(1);
  });
});
