import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Countdown } from "./Countdown";
import { LocalTimeLine, shownLocalTime } from "./EventTiming";

describe("Countdown before mount", () => {
  it("reserves the timer's real boxes, hidden, so mounting shifts nothing", () => {
    const html = renderToStaticMarkup(
      <Countdown startsAt="2026-10-07T00:30:00.000Z" label="Starts in" />,
    );
    expect(html.match(/tabular-nums/g)).toHaveLength(4);
    expect(html).toContain('class="invisible flex gap-2 sm:gap-3"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="timer"');
  });
});

describe("LocalTimeLine", () => {
  const START = "2026-10-07T00:30:00.000Z";

  it("server-renders the same held line before and after the start", () => {
    const line = (startsAt: string) =>
      renderToStaticMarkup(
        <LocalTimeLine startsAt={startsAt} className="mt-1" />,
      );
    const held = '<p class="truncate mt-1" aria-hidden="true">\u00a0</p>';
    expect(line(START)).toBe(held);
    expect(line("2020-01-01T00:00:00.000Z")).toBe(held);
  });

  it("shows the zone text only once mounted and before the start", () => {
    const text = "Your time: 8:30 PM EDT";
    const start = Date.parse(START);
    expect(shownLocalTime(null, START, text)).toBeNull();
    expect(shownLocalTime(start - 1, START, text)).toBe(text);
    expect(shownLocalTime(start, START, text)).toBeNull();
    expect(shownLocalTime(start + 3_600_000, START, text)).toBeNull();
  });
});
