import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventLabel } from "./EventLabel";

describe("EventLabel", () => {
  it("keeps 'at' with the time and zone on one line", () => {
    const html = renderToStaticMarkup(
      <EventLabel
        label="October 6, 2026 at 7:30 PM CDT"
        startsAt="2026-10-07T00:30:00.000Z"
      />,
    );
    expect(html).toBe(
      'Tuesday, October 6, 2026 <span class="whitespace-nowrap">at 7:30 PM CDT</span>',
    );
  });

  it("still keeps a time with no 'at' together", () => {
    const html = renderToStaticMarkup(
      <EventLabel label="September 1, 2026 12 PM CST" />,
    );
    expect(html).toBe(
      'September 1, 2026 <span class="whitespace-nowrap">12 PM CST</span>',
    );
  });
});
