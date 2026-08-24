import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YouTubeEmbedFrame } from "./YouTubeEmbedFrame";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";

const embed = getVideoEmbed("https://www.youtube.com/watch?v=kb8ryBm6g9k")!;

describe("YouTubeEmbedFrame", () => {
  it("renders the click-to-play facade", () => {
    const html = renderToStaticMarkup(
      <YouTubeEmbedFrame embed={embed} title="Test video" />,
    );
    expect(html).toContain("Play Test video");
    expect(html).toContain("hqdefault.jpg");
  });

  // The iframe only mounts after a click, so it is unreachable from a server
  // render. Guard the source instead: a `sandbox` without allow-same-origin
  // gives the frame an opaque origin the YouTube player cannot run in, and it
  // renders a black box. Every embed on the site goes through this component.
  it("never sandboxes the YouTube iframe", () => {
    const source = readFileSync(
      new URL("./YouTubeEmbedFrame.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("<iframe");
    expect(source).not.toContain("sandbox");
  });
});
