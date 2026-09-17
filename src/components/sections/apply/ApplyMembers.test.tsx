import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplyMembers } from "./ApplyMembers";
import { applyMembers } from "@/lib/content/apply-page";
import anthonyKolodziej from "../../../../data/case-studies/anthony-kolodziej.json";
import mallerieRouch from "../../../../data/case-studies/mallerie-rouch.json";
import musaSadi from "../../../../data/case-studies/musa-sadi.json";

const caseStudies = [anthonyKolodziej, mallerieRouch, musaSadi];

// Locks the success-story cards: three cards, each playing the correct member's
// video in the on-page dialog. A wrong id plays the wrong person's story, so
// the name→id pairing is asserted explicitly.
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
    ["Mallorie Rauch", "io1Jkei-yFs"],
    ["Musa Sadi", "kb8ryBm6g9k"],
  ])("pairs %s with their own story video", (name, videoId) => {
    const card = applyMembers.cards.find((c) => c.name === name);
    expect(card?.youtubeId).toBe(videoId);
    expect(html).toContain(`Watch ${name.split(" ")[0]}`);
  });

  /*
    The booking funnels exist to get a form filled in. Adam, 2026-09-17: these
    cards used to open youtube.com in a new tab, so the strongest proof on the
    page was also its widest exit. They now play in a dialog over the page —
    this asserts no card can quietly go back to navigating away.
  */
  it("never links off the page", () => {
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain("youtu.be");
    expect(html).not.toContain("youtube.com");
  });

  it("opens the story with an on-page control, not a link", () => {
    // Two controls per card (the art and the caption) = six buttons.
    const buttonCount = (html.match(/<button/g) ?? []).length;
    expect(buttonCount).toBeGreaterThanOrEqual(6);
    expect(html).toContain("<dialog");
  });

  it("does not mount a player until a story is opened", () => {
    // Three autoplaying iframes on load would be a real cost to every visitor.
    expect(html).not.toContain("<iframe");
  });

  it("carries the transcribed story in each image's alt text", () => {
    for (const card of applyMembers.cards) {
      expect(card.alt).toMatch(/Success story/);
      expect(card.alt.length).toBeGreaterThan(120);
    }
  });

  /*
    Root-cause guard. /apply and /case-studies both name the same members, and
    they had drifted: /apply said "Mallerie Rouch" and "Moosa Sadi" while the
    case studies said "Mallorie Rauch" and "Musa Sadi" — one person, two public
    spellings. Asserting the two sources agree, joined on the video id, stops
    a fix in one place from silently leaving the other wrong.

    This locks them to each OTHER, not to a spelling. If a member tells us the
    true spelling is different, change the case study and this test points at
    whatever else still needs updating.
  */
  it("spells every member the same way the case studies do", () => {
    const byVideoId = new Map(
      caseStudies.map((study) => [study.video_id, study.member_name]),
    );
    for (const card of applyMembers.cards) {
      const canonical = byVideoId.get(card.youtubeId);
      if (!canonical) continue; // not every apply card needs a case study
      expect(card.name).toBe(canonical);
      expect(card.alt).toContain(canonical);
    }
  });
});
