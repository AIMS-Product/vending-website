import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplyMembers } from "./ApplyMembers";
import { applyMembers } from "@/lib/content/apply-page";

// Locks the success-story cards: three cards, each linking to the correct
// member's YouTube video in a new tab. A wrong href sends viewers to the wrong
// person's story, so the name→URL pairing is asserted explicitly.
describe("ApplyMembers success-story cards", () => {
  const html = renderToStaticMarkup(<ApplyMembers />);

  it("renders exactly three story cards", () => {
    expect(applyMembers.cards).toHaveLength(3);
    // next/image URL-encodes the src (e.g. %2Fapply%2Fstories%2Fanthony.png),
    // so assert each card's image basename is present in that encoded form.
    for (const slug of ["anthony", "mallerie", "moosa"]) {
      expect(html).toContain(`stories%2F${slug}.png`);
    }
  });

  it.each([
    ["Anthony Kolodziej", "fsRX7K_Hg08"],
    ["Mallerie Rouch", "io1Jkei-yFs"],
    ["Moosa Sadi", "kb8ryBm6g9k"],
  ])("links %s to their YouTube story", (name, videoId) => {
    const card = applyMembers.cards.find((c) => c.name === name);
    expect(card?.youtubeUrl).toContain(videoId);
    expect(html).toContain(`https://youtu.be/${videoId}`);
    expect(html).toContain(`Watch ${name.split(" ")[0]}`);
  });

  it("opens each story in a new tab with a safe rel", () => {
    const anchorCount = (html.match(/target="_blank"/g) ?? []).length;
    // One card link + one caption link per card = 6 for three cards.
    expect(anchorCount).toBe(6);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('rel="noreferrer noopener"undefined');
  });

  it("carries the transcribed story in each image's alt text", () => {
    for (const card of applyMembers.cards) {
      expect(card.alt).toMatch(/Success story/);
      expect(card.alt.length).toBeGreaterThan(120);
    }
  });
});
