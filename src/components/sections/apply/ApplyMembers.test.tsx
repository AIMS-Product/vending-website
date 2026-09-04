import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplyMembers } from "./ApplyMembers";
import { applyMembers } from "@/lib/content/apply-page";
import anthonyKolodziej from "../../../../data/case-studies/anthony-kolodziej.json";
import mallerieRouch from "../../../../data/case-studies/mallerie-rouch.json";
import musaSadi from "../../../../data/case-studies/musa-sadi.json";

const caseStudies = [anthonyKolodziej, mallerieRouch, musaSadi];

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
    ["Mallorie Rauch", "io1Jkei-yFs"],
    ["Musa Sadi", "kb8ryBm6g9k"],
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
      const videoId = card.youtubeUrl.split("/").pop();
      const canonical = byVideoId.get(videoId ?? "");
      if (!canonical) continue; // not every apply card needs a case study
      expect(card.name).toBe(canonical);
      expect(card.alt).toContain(canonical);
    }
  });
});
