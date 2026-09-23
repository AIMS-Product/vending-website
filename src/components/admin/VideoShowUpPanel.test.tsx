import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MIN_CALLS_FOR_RATE, VideoShowUpPanel } from "./VideoShowUpPanel";

const render = (props: Parameters<typeof VideoShowUpPanel>[0]["showUp"]) =>
  renderToStaticMarkup(<VideoShowUpPanel showUp={props} />);

describe("VideoShowUpPanel", () => {
  it("gives counts but no percentage while a group is too small", () => {
    // 3 of 4 is "75%" and means nothing yet; the page must not say it.
    const html = render({
      connected: true,
      watched: { held: 3, noShow: 1 },
      watchedNothing: { held: 0, noShow: 0 },
    });
    expect(html).toContain("3 of 4 showed (too few to compare yet)");
    expect(html).not.toContain("75%");
    expect(html).toContain("No logged first calls yet");
  });

  it("shows the rate once a group has enough logged calls", () => {
    const html = render({
      connected: true,
      watched: { held: MIN_CALLS_FOR_RATE - 5, noShow: 5 },
      watchedNothing: { held: 10, noShow: 10 },
    });
    expect(html).toContain(
      `${MIN_CALLS_FOR_RATE - 5} of ${MIN_CALLS_FOR_RATE} showed (75%)`,
    );
    expect(html).toContain("10 of 20 showed (50%)");
  });

  it("says so when Close could not be read, instead of showing zeros", () => {
    const html = render({
      connected: false,
      watched: { held: 0, noShow: 0 },
      watchedNothing: { held: 0, noShow: 0 },
    });
    expect(html).toContain("could not be read");
    expect(html).not.toContain("No logged first calls yet");
  });
});
