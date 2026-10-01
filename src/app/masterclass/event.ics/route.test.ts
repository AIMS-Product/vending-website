import { beforeEach, describe, expect, it, vi } from "vitest";
import { foldIcsLine } from "@/lib/content/masterclass";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getMasterclassEvent: vi.fn() }));

vi.mock("@/lib/services/masterclass-event", () => ({
  getMasterclassEvent: mocks.getMasterclassEvent,
}));

const octets = (line: string) => new TextEncoder().encode(line).length;

/** RFC 5545 unfolding: drop every CRLF that is followed by one space. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("GET /masterclass/event.ics", () => {
  beforeEach(() => {
    mocks.getMasterclassEvent.mockResolvedValue({
      label: "October 6, 2026 at 7:30 PM CDT",
      startsAt: "2026-10-07T00:30:00.000Z",
    });
  });

  it("folds every content line to 75 octets with CRLF and a space", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    const ics = await response.text();
    const lines = ics.split("\r\n");
    for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75);
    // The long DESCRIPTION really was folded, and unfolds back to one line.
    expect(lines.some((line) => line.startsWith(" "))).toBe(true);
    expect(unfold(ics)).toContain(
      "DESCRIPTION:Your personal Zoom link is in your confirmation email from anthony@webinar.vendingpreneurs.co.\r\n",
    );
  });

  it("names the location and sets a 30-minute reminder", async () => {
    const ics = unfold(await (await GET()).text());
    expect(ics).toContain(
      "LOCATION:Zoom (link in your confirmation email)\r\n",
    );
    expect(ics).toContain(
      "BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\nEND:VEVENT\r\n",
    );
  });

  it("404s while the date is not set", async () => {
    mocks.getMasterclassEvent.mockResolvedValue({
      label: null,
      startsAt: null,
    });
    expect((await GET()).status).toBe(404);
  });
});

describe("foldIcsLine", () => {
  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:Masterclass")).toBe("SUMMARY:Masterclass");
  });

  it("never splits a multi-byte character across a fold", () => {
    const line = `DESCRIPTION:${"é".repeat(60)}`;
    const folded = foldIcsLine(line);
    for (const part of folded.split("\r\n"))
      expect(octets(part)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});
