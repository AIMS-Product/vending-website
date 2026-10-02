import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Countdown } from "./Countdown";
import { LocalTimeLine } from "./EventTiming";

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

describe("LocalTimeLine before mount", () => {
  it("holds its line so the zone text arriving moves nothing", () => {
    const html = renderToStaticMarkup(
      <LocalTimeLine startsAt="2026-10-07T00:30:00.000Z" className="mt-1" />,
    );
    expect(html).toBe('<p class="mt-1" aria-hidden="true"> </p>');
  });
});
