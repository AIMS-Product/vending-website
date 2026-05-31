import { describe, expect, it } from "vitest";
import {
  createVideoEmbedAutoplayUrl,
  getVideoEmbed,
  parseYouTubeVideoId,
} from "./video-embeds";

describe("video embeds", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts a YouTube id from %s", (url, expected) => {
    expect(parseYouTubeVideoId(url)).toBe(expected);
  });

  it("does not embed unsupported URLs", () => {
    expect(parseYouTubeVideoId("https://example.com/video")).toBeNull();
    expect(parseYouTubeVideoId("/resources/video")).toBeNull();
    expect(parseYouTubeVideoId("not a url")).toBeNull();
  });

  it("builds a YouTube embed", () => {
    expect(getVideoEmbed("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      id: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("builds an autoplay embed URL", () => {
    const embed = getVideoEmbed("https://youtu.be/dQw4w9WgXcQ");

    expect(embed).not.toBeNull();
    expect(createVideoEmbedAutoplayUrl(embed!)).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0",
    );
  });
});
