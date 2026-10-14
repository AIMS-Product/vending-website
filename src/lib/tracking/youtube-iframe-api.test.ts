import { describe, expect, it } from "vitest";
import { youtubeTrackedEmbedUrl } from "./youtube-iframe-api";

describe("youtubeTrackedEmbedUrl", () => {
  it("uses the regular youtube.com player with the JS API on", () => {
    const url = new URL(
      youtubeTrackedEmbedUrl("fsRX7K_Hg08", {
        autoplay: true,
        mute: false,
        origin: "https://www.vendingpreneurs.com",
      }),
    );
    // Not youtube-nocookie: privacy-enhanced mode keeps the view out of the
    // viewer's YouTube history and ads, which is the point of the switch.
    expect(url.origin).toBe("https://www.youtube.com");
    expect(url.pathname).toBe("/embed/fsRX7K_Hg08");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("https://www.vendingpreneurs.com");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.has("mute")).toBe(false);
  });

  it("starts muted only when asked", () => {
    const url = new URL(
      youtubeTrackedEmbedUrl("fsRX7K_Hg08", {
        autoplay: true,
        mute: true,
        origin: "https://www.vendingpreneurs.com",
      }),
    );
    expect(url.searchParams.get("mute")).toBe("1");
  });
});
