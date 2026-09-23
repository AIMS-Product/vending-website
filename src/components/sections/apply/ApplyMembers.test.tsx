import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ApplyMembers, storyPosterSrc } from "./ApplyMembers";
import { preCallOperators } from "@/lib/content/pre-call-resources";
import musaSadi from "../../../../data/case-studies/musa-sadi.json";

/*
  Adam, 2026-09-17: this section used to be three finished card graphics with
  their figures baked into the PNGs, each linking out to youtube.com. It now
  renders the same top-tier member stories the pre-call page uses, read off
  preCallOperators, so a figure can never say one thing here and another there.
*/
const TOP = preCallOperators.items.filter(
  (item) => item.tier === "high" && "embedId" in item,
);

/** "Graham & Katie Parker" renders as "Graham &amp; Katie Parker". */
function escaped(text: string) {
  return text.replace(/&/g, "&amp;");
}

describe("ApplyMembers success stories", () => {
  const html = renderToStaticMarkup(<ApplyMembers />);

  it("shows every top-tier story and no other tier", () => {
    expect(TOP.length).toBeGreaterThanOrEqual(3);
    for (const story of TOP) {
      expect(html).toContain(escaped(story.name));
    }
    const otherTiers = preCallOperators.items.filter(
      (item) => item.tier !== "high",
    );
    for (const story of otherTiers) {
      expect(html, `${story.name} is not a top-tier story`).not.toContain(
        escaped(story.name),
      );
    }
  });

  it("prints each member's figures as text, not baked into an image", () => {
    for (const story of TOP) {
      expect(html).toContain(story.stats.join(" · "));
    }
  });

  /*
    Required wherever these figures appear. The pre-call content module says it
    outright: ranking members by revenue invites the reader to take a tier as a
    promise unless the page states what the numbers actually are. These pages
    are paid ad destinations, so it matters more here, not less.
  */
  it("carries the revenue disclaimer", () => {
    expect(html).toContain(preCallOperators.disclaimer);
  });

  /*
    The booking funnels exist to get a form filled in. The old cards opened
    youtube.com in a new tab, so the strongest proof on the page was also its
    widest exit. Vidalytics plays in place.
  */
  it("never links off the page", () => {
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain("youtu.be");
    expect(html).not.toContain("youtube.com");
  });

  it("gives every member a play control of their own", () => {
    for (const story of TOP) {
      // React escapes the apostrophe in the aria-label, so match the stem.
      expect(html).toContain(`Play ${escaped(story.name)}`);
    }
  });

  /*
    Vidalytics autoplays muted. That suits the pre-call page, whose visitor has
    already booked; here it would put four videos talking at someone in the
    middle of the form, and load four player scripts before anyone asked for
    one. The players mount on click instead.
  */
  it("mounts no player until a story is played", () => {
    expect(html).not.toContain("vidalytics_embed_");
    for (const story of TOP) {
      expect(html).not.toContain((story as { embedId: string }).embedId);
    }
  });

  /*
    The section's job is to show real people. A top-tier story added without a
    saved poster would fall back to a broken image, so each one must ship with
    its still in public/apply/stories/.
  */
  it("shows every member's face before play", () => {
    for (const story of TOP) {
      const src = storyPosterSrc(story.id);
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
      expect(html).toContain(encodeURIComponent(src));
    }
  });

  /*
    Root-cause guard, inherited from the old test. /apply and /case-studies
    both name the same members and had drifted ("Moosa Sadi" vs "Musa Sadi").
    The story data now comes from one module, so this asserts that module
    agrees with the case study rather than that two copies agree.
  */
  it("spells a member the same way the case study does", () => {
    const musa = TOP.find((story) => story.id === "musa-sadi");
    expect(musa?.name).toBe(musaSadi.member_name);
    expect(html).toContain(escaped(musaSadi.member_name));
  });
});
