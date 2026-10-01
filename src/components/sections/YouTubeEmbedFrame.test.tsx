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

  it("keeps the centred disc by default and moves it to the corner on cards", () => {
    const hero = renderToStaticMarkup(
      <YouTubeEmbedFrame embed={embed} title="Host video" />,
    );
    expect(hero).toContain("-translate-x-1/2");
    expect(hero).not.toContain("right-3");

    const card = renderToStaticMarkup(
      <YouTubeEmbedFrame embed={embed} title="Member story" variant="card" />,
    );
    // Clear of the burned-in result text, and no centring translate.
    expect(card).toMatch(/absolute right-3[^"]*bottom-3/);
    expect(card).not.toContain("left-3");
    expect(card).toContain("size-10");
    expect(card).toContain("border-ink");
    expect(card).not.toContain("-translate-x-1/2");
    // The whole thumbnail is still the one labelled button.
    expect(card).toContain('aria-label="Play Member story"');
    expect(card.match(/<button/g)).toHaveLength(1);
  });

  it("keeps the heavy scrim on the hero and a light one on cards", () => {
    const hero = renderToStaticMarkup(
      <YouTubeEmbedFrame embed={embed} title="Host video" />,
    );
    expect(hero).toContain("rgba(0,0,0,0.35)");

    const card = renderToStaticMarkup(
      <YouTubeEmbedFrame embed={embed} title="Member story" variant="card" />,
    );
    expect(card).toContain("rgba(0,0,0,0.15)");
    expect(card).not.toContain("rgba(0,0,0,0.35)");
  });

  it("moves the card button to the top-right when asked", () => {
    const card = renderToStaticMarkup(
      <YouTubeEmbedFrame
        embed={embed}
        title="Member story"
        variant="card"
        playPosition="tr"
      />,
    );
    expect(card).toMatch(/absolute right-3[^"]*top-3/);
    expect(card).not.toContain("bottom-3");
  });

  it("moves the card button to the bottom-left when asked", () => {
    const card = renderToStaticMarkup(
      <YouTubeEmbedFrame
        embed={embed}
        title="Member story"
        variant="card"
        playPosition="bl"
      />,
    );
    expect(card).toMatch(/absolute left-3[^"]*bottom-3/);
    expect(card).not.toContain("right-3");
    expect(card).not.toContain("top-3");
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
