import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_KEYS,
  MASTERCLASS_ICS_PATH,
  calendarIcs,
  calendarLinks,
  confirmedPlaybookParams,
  masterclassLiveEnd,
  masterclassPhase,
  parseWebinarStart,
  safeFirstName,
} from "./masterclass";
import { playbookHref } from "./playbook";

describe("parseWebinarStart", () => {
  it("reads the GHL date value as Central time", () => {
    expect(
      parseWebinarStart("October 6, 2026 at 7:30 PM CDT")?.toISOString(),
    ).toBe("2026-10-07T00:30:00.000Z");
    expect(
      parseWebinarStart(
        "October 6, 2026 Tuesday at 7:30 PM CDT",
      )?.toISOString(),
    ).toBe("2026-10-07T00:30:00.000Z");
  });

  it("uses the real Chicago offset, not the written zone: 'CST' in September is still CDT", () => {
    expect(
      parseWebinarStart("September 1, 2026 at 12 PM CST")?.toISOString(),
    ).toBe("2026-09-01T17:00:00.000Z");
  });

  it("switches to CST after daylight saving ends", () => {
    expect(
      parseWebinarStart("November 10, 2026 at 12 PM CST")?.toISOString(),
    ).toBe("2026-11-10T18:00:00.000Z");
  });

  it("returns null rather than guessing on text it cannot read", () => {
    expect(parseWebinarStart("next Tuesday")).toBeNull();
    expect(parseWebinarStart("Octember 6, 2026 at 7 PM")).toBeNull();
  });
});

describe("calendarLinks", () => {
  it("builds a 75-minute event in UTC for Google and a downloadable ics", () => {
    const links = calendarLinks({
      title: "Masterclass",
      details: "Zoom link in your email",
      start: new Date("2026-10-07T00:30:00.000Z"),
      minutes: 75,
    });
    expect(new URL(links.google).searchParams.get("dates")).toBe(
      "20261007T003000Z/20261007T014500Z",
    );
    expect(links.ics).toBe(MASTERCLASS_ICS_PATH);
  });
});

describe("calendarIcs", () => {
  const event = {
    title: "Masterclass",
    details: "Zoom link in your email, from Anthony; see you there",
    start: new Date("2026-10-07T00:30:00.000Z"),
    minutes: 75,
  };

  it("stamps the file with the time it was made, not the start", () => {
    const ics = calendarIcs(event, new Date("2026-09-30T15:04:05.678Z"));
    expect(ics).toContain("DTSTAMP:20260930T150405Z\r\n");
    expect(ics).toContain("DTSTART:20261007T003000Z\r\n");
    expect(ics).toContain("DTEND:20261007T014500Z\r\n");
  });

  it("escapes commas and semicolons in text fields", () => {
    expect(calendarIcs(event)).toContain(
      "DESCRIPTION:Zoom link in your email\\, from Anthony\\; see you there",
    );
  });
});

describe("ATTRIBUTION_KEYS", () => {
  it("carries Google click ids as well as UTMs and fbclid", () => {
    expect(ATTRIBUTION_KEYS).toEqual(
      expect.arrayContaining([
        "utm_source",
        "fbclid",
        "gclid",
        "gbraid",
        "wbraid",
      ]),
    );
  });
});

describe("safeFirstName", () => {
  it("accepts a plain name and rejects anything else", () => {
    expect(safeFirstName({ first: " Mary " })).toBe("Mary");
    expect(safeFirstName({ first: "Anne-Marie" })).toBe("Anne-Marie");
    expect(safeFirstName({ first: "O'Neil" })).toBe("O'Neil");
    expect(safeFirstName({ first: "<script>" })).toBeUndefined();
    expect(safeFirstName({ first: "evil.com" })).toBeUndefined();
    expect(safeFirstName({ first: "a".repeat(21) })).toBeUndefined();
    expect(safeFirstName({})).toBeUndefined();
  });

  it("keeps only the first word, so a link cannot print a sentence", () => {
    expect(safeFirstName({ first: "Your account is suspended call now" })).toBe(
      "Your",
    );
    expect(safeFirstName({ first: "Anne-Marie O'Neil" })).toBe("Anne-Marie");
    expect(safeFirstName({ first: "visit evil.com" })).toBe("Visit");
  });

  it("capitalises the first letter", () => {
    expect(safeFirstName({ first: "adam" })).toBe("Adam");
    expect(safeFirstName({ first: "élodie" })).toBe("Élodie");
  });
});

describe("confirmed page Playbook link", () => {
  it("keeps the ad attribution and the validated first name", () => {
    const href = playbookHref(
      confirmedPlaybookParams({
        first: "Mary",
        utm_source: "meta",
        utm_campaign: "sep-22",
        fbclid: "abc",
      }),
    );
    const query = new URL(href, "https://x.test").searchParams;
    expect(query.get("utm_source")).toBe("meta");
    expect(query.get("utm_campaign")).toBe("sep-22");
    expect(query.get("fbclid")).toBe("abc");
    expect(query.get("full_name")).toBe("Mary");
  });

  it("never forwards contact details or an invalid name", () => {
    const params = confirmedPlaybookParams({
      first: "http://x",
      email: "a@b.co",
      phone: "5415550123",
      full_name: "Someone Else",
      utm_source: "meta",
    });
    const query = new URL(playbookHref(params), "https://x.test").searchParams;
    expect(query.get("utm_source")).toBe("meta");
    expect(query.has("full_name")).toBe(false);
    expect(query.has("email")).toBe(false);
    expect(query.has("phone")).toBe(false);
  });
});

describe("masterclassPhase", () => {
  const startsAt = "2026-10-07T00:30:00.000Z";
  const at = (iso: string) => Date.parse(iso);

  it("is upcoming before the start, or with no readable start", () => {
    expect(masterclassPhase(at("2026-10-06T12:00:00Z"), startsAt)).toBe(
      "upcoming",
    );
    expect(masterclassPhase(at("2026-10-08T12:00:00Z"), null)).toBe("upcoming");
  });

  it("is live for 90 minutes from the start", () => {
    expect(masterclassPhase(at(startsAt), startsAt)).toBe("live");
    expect(masterclassPhase(at("2026-10-07T00:45:00Z"), startsAt)).toBe("live");
    expect(masterclassPhase(at("2026-10-07T01:59:59Z"), startsAt)).toBe("live");
  });

  it("is ended from 90 minutes after the start", () => {
    expect(masterclassPhase(at("2026-10-07T02:00:00Z"), startsAt)).toBe(
      "ended",
    );
    expect(masterclassPhase(at("2026-10-08T12:00:00Z"), startsAt)).toBe(
      "ended",
    );
  });

  it("ends the countdown's live window at the same instant", () => {
    expect(masterclassLiveEnd(startsAt)).toBe("2026-10-07T02:00:00.000Z");
    expect(masterclassLiveEnd(null)).toBeNull();
  });
});
