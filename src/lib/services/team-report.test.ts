import { describe, expect, it } from "vitest";
import type { CallCredit } from "./call-credit";
import {
  buildAds,
  buildClosers,
  buildSetters,
  buildSocials,
  buildWebinars,
  costPer,
  isFirstCallCalendar,
  outcomeOf,
  rateOf,
  type CreditedBooking,
  type FunnelLeadRow,
  type HostedBooking,
} from "./team-report";

const september = { start: "2026-09-01", end: "2026-09-30" };

function lead(overrides: Partial<FunnelLeadRow>): FunnelLeadRow {
  return {
    lead_id: overrides.lead_id ?? `lead_${Math.random()}`,
    display_name: null,
    email: null,
    funnel: "Reactivation Scrapers",
    first_sales_call_booked_date: "2026-09-10",
    first_call_show_up: null,
    status_label: null,
    setter_name: null,
    ...overrides,
  };
}

function rep(who: string, basis: CallCredit["basis"]): CallCredit {
  return { kind: "rep", basis, who, evidence: "", repUri: null };
}

function booking(overrides: Partial<CreditedBooking>): CreditedBooking {
  return {
    email: null,
    bookedAt: "2026-09-10T15:00:00Z",
    startAt: "2026-09-12T15:00:00Z",
    calendar: "Vendingpreneurs Consultation Call",
    canceled: false,
    credit: { kind: "untagged", who: "No tag", evidence: "", repUri: null },
    ...overrides,
  };
}

describe("outcomeOf", () => {
  it("reads Close's emoji-prefixed labels by their words", () => {
    expect(
      outcomeOf(
        lead({ first_call_show_up: "Yes", status_label: "🏆 Closed / Won" }),
      ),
    ).toEqual({ showKnown: true, showed: true, closed: true, won: true });
    expect(
      outcomeOf(
        lead({ first_call_show_up: "No", status_label: "📄 Contract Sent" }),
      ),
    ).toEqual({ showKnown: true, showed: false, closed: true, won: false });
    expect(outcomeOf(lead({ status_label: "📞 Follow Up" }))).toEqual({
      showKnown: false,
      showed: false,
      closed: false,
      won: false,
    });
  });
});

describe("rates", () => {
  it("never prints a rate over 100 and never divides by nothing", () => {
    expect(rateOf(3, 4)).toBe(75);
    expect(rateOf(5, 4)).toBeNull();
    expect(rateOf(0, 0)).toBeNull();
    expect(costPer(1000, 3)).toBe(333.33);
    expect(costPer(1000, 0)).toBeNull();
    expect(costPer(null, 3)).toBeNull();
  });
});

describe("isFirstCallCalendar", () => {
  it("keeps sales calls and drops everything after the first one", () => {
    expect(isFirstCallCalendar("Vendingpreneurs Consultation Call")).toBe(true);
    expect(isFirstCallCalendar("Vending Route Advisory Call")).toBe(true);
    expect(isFirstCallCalendar("Vendingpreneurs Onboarding Call")).toBe(false);
    expect(isFirstCallCalendar("Vendingpreneurs - Next Steps Call")).toBe(
      false,
    );
    expect(isFirstCallCalendar("Vendingpreneurs Rescheduled Call")).toBe(false);
    expect(isFirstCallCalendar("30 Minute Meeting")).toBe(false);
    expect(isFirstCallCalendar(null)).toBe(false);
  });
});

describe("buildSetters", () => {
  it("credits Close first calls through Calendly, then Close's setter field, and splits the basis", () => {
    const report = buildSetters({
      leads: [
        // Calendly recorded Connor booking it; Close names nobody.
        lead({ email: "a@x.com", first_call_show_up: "Yes" }),
        // Close names Vince; no Calendly booking at all.
        lead({
          email: "b@x.com",
          setter_name: "Vince Bartolini",
          status_label: "🏆 Closed / Won",
          first_call_show_up: "Yes",
        }),
        // Link tag names Charlie.
        lead({ email: "c@x.com", first_call_show_up: "No" }),
        // Nobody named: self-booked.
        lead({ email: "d@x.com" }),
        // Outside the period: ignored.
        lead({ email: "e@x.com", first_sales_call_booked_date: "2026-08-30" }),
      ],
      bookings: [
        booking({ email: "a@x.com", credit: rep("Connor George", "calendly") }),
        booking({ email: "c@x.com", credit: rep("Charlie Ingram", "tag") }),
        // Connor also set a call Close does not hold as a first call.
        booking({ email: "z@x.com", credit: rep("Connor George", "calendly") }),
        // A second booking for the same address is the same call set once.
        booking({
          email: "z@x.com",
          bookedAt: "2026-09-11T15:00:00Z",
          credit: rep("Connor George", "calendly"),
        }),
        // Set last month: not this period's.
        booking({
          email: "y@x.com",
          bookedAt: "2026-08-20T15:00:00Z",
          credit: rep("Connor George", "calendly"),
        }),
      ],
      period: september,
      months: 1,
      targetsApply: true,
    });

    expect(report.rows.map((row) => [row.who, row.set, row.booked])).toEqual([
      ["Connor George", 2, 1],
      ["Charlie Ingram", 1, 1],
      ["Vince Bartolini", 1, 1],
    ]);
    const connor = report.rows[0];
    expect(connor.recorded).toBe(2);
    expect(connor.showed).toBe(1);
    const charlie = report.rows[1];
    expect(charlie.tagged).toBe(1);
    expect(charlie.showKnown).toBe(1);
    expect(charlie.showed).toBe(0);
    const vince = report.rows[2];
    expect(vince.recorded).toBe(1);
    expect(vince.closed).toBe(1);
    expect(vince.won).toBe(1);
    expect(report.selfBooked.booked).toBe(1);
    expect(report.total.booked).toBe(3);
    expect(report.total.set).toBe(4);
    expect(report.target).toBe(330);
  });

  it("lets Close's setter field beat a channel tag but not Calendly's record, and keeps the inferred touch last", () => {
    const channel: CallCredit = {
      kind: "channel",
      who: "Youtube",
      evidence: "",
      repUri: null,
    };
    const report = buildSetters({
      leads: [
        lead({ email: "a@x.com", setter_name: "Pearl Sathekge" }),
        lead({ email: "b@x.com", setter_name: "Pearl Sathekge" }),
        lead({ email: "c@x.com", setter_name: "Pearl Sathekge" }),
      ],
      bookings: [
        booking({ email: "a@x.com", credit: channel }),
        booking({ email: "b@x.com", credit: rep("August Young", "calendly") }),
        booking({ email: "c@x.com", credit: rep("August Young", "touch") }),
      ],
      period: september,
      months: 1,
      targetsApply: false,
    });
    expect(report.rows.map((row) => [row.who, row.booked])).toEqual([
      ["Pearl Sathekge", 2],
      ["August Young", 1],
    ]);
    expect(report.target).toBeNull();
  });

  it("names setters who are on neither roster list instead of guessing a role", () => {
    const report = buildSetters({
      leads: [lead({ email: "a@x.com", setter_name: "William Nowak" })],
      bookings: [],
      period: september,
      months: 1,
      targetsApply: false,
    });
    expect(report.rows[0].role).toBe("unclassified");
    expect(report.unclassified).toEqual(["William Nowak"]);
  });
});

describe("buildClosers", () => {
  function hosted(overrides: Partial<HostedBooking>): HostedBooking {
    return {
      email: null,
      calendar: "Vendingpreneurs Consultation",
      startAt: "2026-09-15T16:00:00Z",
      canceled: false,
      hosts: ["Shreya Bechra"],
      ...overrides,
    };
  }

  it("counts first calls on each host's calendar in the period and reads the outcome from Close", () => {
    const report = buildClosers({
      leads: [
        // Booked in August, held in September: still this period's outcome.
        lead({
          email: "a@x.com",
          first_sales_call_booked_date: "2026-08-28",
          first_call_show_up: "Yes",
          status_label: "🏆 Closed / Won",
        }),
        lead({ email: "b@x.com", first_call_show_up: "No" }),
        // Booked this month with no Calendly booking anywhere.
        lead({ email: "n@x.com", first_call_show_up: "Yes" }),
      ],
      hosted: [
        hosted({ email: "a@x.com" }),
        hosted({ email: "b@x.com", hosts: ["Joseph Vaughan"], canceled: true }),
        // No Close record for this address.
        hosted({ email: "c@x.com" }),
        // Not a first call.
        hosted({
          email: "a@x.com",
          calendar: "Vendingpreneurs - Next Steps Call",
        }),
        // A team calendar, not a person.
        hosted({ email: "d@x.com", hosts: ["Onboarding Team"] }),
        // Held next month.
        hosted({ email: "e@x.com", startAt: "2026-10-02T16:00:00Z" }),
      ],
      period: september,
    });

    expect(
      report.rows.map((row) => [row.who, row.booked, row.matched]),
    ).toEqual([
      ["Shreya Bechra", 2, 1],
      ["Joseph Vaughan", 1, 1],
    ]);
    expect(report.rows[0].showed).toBe(1);
    expect(report.rows[0].won).toBe(1);
    expect(report.rows[1].canceled).toBe(1);
    expect(report.rows[1].showKnown).toBe(1);
    expect(report.total.booked).toBe(3);
    expect(report.noHost.booked).toBe(1);
    expect(report.noHost.showed).toBe(1);
  });
});

describe("buildWebinars", () => {
  it("attributes Webinar spend from the day after the previous webinar and holds the targets", () => {
    const report = buildWebinars({
      events: [
        {
          date: "2026-08-25",
          label: "Aug 25",
          format: "Live",
          registrations: 1000,
          attendees: 100,
          attendees_at_offer: 50,
          showed: 10,
          won: 1,
        },
        {
          date: "2026-09-01",
          label: "Sept 1",
          format: "Live",
          registrations: 800,
          attendees: 200,
          attendees_at_offer: 140,
          booked_ever: 40,
          showed: 20,
          won: 2,
        },
        {
          date: "2026-09-08",
          label: "Sept 8",
          format: "Live",
          registrations: 500,
          attendees: 600,
          attendees_at_offer: null,
          showed: null,
          won: null,
        },
      ],
      spend: [
        { day: "2026-08-25", channel: "Webinar", spend: 999 },
        { day: "2026-08-26", channel: "Webinar", spend: 1000 },
        { day: "2026-09-01", channel: "Webinar", spend: 1000 },
        { day: "2026-09-01", channel: "Meta Ads", spend: 5000 },
        { day: "2026-09-05", channel: "Webinar", spend: 300 },
      ],
      period: september,
    });

    expect(report.rows.map((row) => row.label)).toEqual(["Sept 8", "Sept 1"]);
    const sept1 = report.rows[1];
    expect(sept1.spend).toBe(2000);
    expect(sept1.spendFrom).toBe("2026-08-26");
    expect(sept1.attendanceRate).toBe(25);
    expect(sept1.offerRate).toBe(70);
    expect(sept1.costPerRegistration).toBe(2.5);
    expect(sept1.costPerBooked).toBe(50);
    const sept8 = report.rows[0];
    expect(sept8.spend).toBe(300);
    // More attendees than registrations is not a rate.
    expect(sept8.attendanceRate).toBeNull();
    expect(sept8.booked).toBeNull();
    expect(sept8.costPerBooked).toBeNull();
    expect(report.total?.registrations).toBe(1300);
    expect(report.total?.spend).toBe(2300);
    expect(report.total?.booked).toBe(40);
  });
});

describe("buildSocials", () => {
  it("counts posts per whole week by brand and network and sums video views", () => {
    const report = buildSocials({
      posts: [
        {
          network: "instagram",
          brand_id: "6633336",
          published_at: "2026-09-01T10:00:00Z",
        },
        {
          network: "instagram",
          brand_id: "6633336",
          published_at: "2026-09-06T10:00:00Z",
        },
        {
          network: "instagram",
          brand_id: "6633345",
          published_at: "2026-09-02T10:00:00Z",
        },
        {
          network: "twitter",
          brand_id: "6633336",
          published_at: "2026-09-02T10:00:00Z",
        },
        {
          network: "youtube",
          brand_id: "6626386",
          published_at: "2026-09-03T10:00:00Z",
        },
        // Monday Aug 31 belongs to the first September week.
        {
          network: "facebook",
          brand_id: "6626386",
          published_at: "2026-08-31T10:00:00Z",
        },
        // Outside every week of the period.
        {
          network: "instagram",
          brand_id: "6633336",
          published_at: "2026-08-20T10:00:00Z",
        },
      ],
      views: [
        { day: "2026-09-01", views: 100 },
        { day: "2026-09-02", views: 50 },
        { day: "2026-09-09", views: 7 },
      ],
      period: september,
      today: "2026-09-14",
    });

    const first = report.weeks.find((week) => week.start === "2026-08-31");
    expect(first).toMatchObject({
      end: "2026-09-06",
      complete: true,
      igMike: 2,
      igAnthony: 1,
      facebook: 1,
      x: 1,
      youtubeUploads: 1,
      youtubeViews: 150,
    });
    expect(report.weeks[0].start).toBe("2026-09-28");
    expect(
      report.weeks.find((week) => week.start === "2026-09-14")?.complete,
    ).toBe(false);
    expect(
      report.weeks.find((week) => week.start === "2026-09-21")?.youtubeViews,
    ).toBeNull();
    expect(report.total.igMike).toBe(2);
    expect(report.total.youtubeViews).toBe(157);
  });
});

describe("buildAds", () => {
  const fact = (overrides: Record<string, unknown>) =>
    ({
      day: "2026-09-01",
      channel: "Google Ads",
      source: "google",
      medium: "cpc",
      campaign: "1",
      content: "(not set)",
      destination: "(not set)",
      spend: null,
      impressions: null,
      reach: null,
      clicks: null,
      visits: null,
      thankyou_visits: null,
      leads: null,
      booked: null,
      showed: null,
      won: null,
      revenue: null,
      ...overrides,
    }) as never;

  it("joins Google spend and leads by campaign id and names the row from the spend row", () => {
    const report = buildAds({
      facts: [
        fact({
          campaign: "1",
          content: "VP | Brand",
          spend: 100,
          impressions: 10,
        }),
        fact({ campaign: "1", leads: 4, booked: 2 }),
        fact({ campaign: "2", content: "Conquest", spend: 50 }),
        fact({
          channel: "Meta Ads",
          source: "meta_ads",
          campaign: "9",
          content: "LL - VSL",
          spend: 200,
        }),
        fact({
          channel: "Meta Ads",
          source: "meta_ads",
          campaign: "vsl-slug",
          leads: 10,
        }),
        fact({ channel: "Instagram", source: "ig", campaign: "x", leads: 3 }),
        // A registration row with a zero spend and a placeholder name keeps
        // its campaign slug as the label.
        fact({
          channel: "Webinar",
          source: "meta_ads",
          campaign: "webinar-2026-09-01",
          content: "unattributed",
          spend: 0,
          leads: 800,
        }),
      ],
    });

    expect(report.channels.map((channel) => channel.channel)).toEqual([
      "Google Ads",
      "Meta Ads",
      "Webinar",
    ]);
    expect(report.channels[2].campaigns[0].label).toBe("webinar-2026-09-01");
    const google = report.channels[0];
    expect(google.spend).toBe(150);
    expect(google.leads).toBe(4);
    expect(google.costPerLead).toBe(37.5);
    expect(
      google.campaigns.map((c) => [c.label, c.spend, c.leads, c.costPerLead]),
    ).toEqual([
      ["VP | Brand", 100, 4, 25],
      ["Conquest", 50, null, null],
    ]);
    const meta = report.channels[1];
    expect(meta.costPerLead).toBe(20);
    expect(meta.campaigns.map((c) => [c.label, c.spend, c.leads])).toEqual([
      ["LL - VSL", 200, null],
      ["vsl-slug", null, 10],
    ]);
  });
});
